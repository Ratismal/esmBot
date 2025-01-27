#include <cstring>
#include <map>
#include <vips/vips8>

#include "common.h"

using namespace std;
using namespace vips;

VImage toPolar(VImage image, int width, int height) {
  VImage xy = VImage::xyz(width, height);
  xy -= {width / 2.0, height / 2.0};
  int scale = max(width, height) / width;
  xy *= 1.5 / scale;
  VImage xy_complex = xy.copy(VImage::option()->set("format", VIPS_FORMAT_COMPLEX)->set("bands", 1));

  VImage indexComplex = xy_complex.polar();
  VImage index = indexComplex.copy(VImage::option()->set("format", VIPS_FORMAT_FLOAT)->set("bands", 2));
  index *= {1, height / 360.0};

  return image.mapim(index,
                     VImage::option()->set("extend", VIPS_EXTEND_MIRROR));
}

VImage toRectangular(VImage image, int width, int height) {
  VImage xy = VImage::xyz(width, height);
  xy *= vector<double>{1, 360.0 / height};
  VImage xy_complex = xy.copy(VImage::option()->set("format", VIPS_FORMAT_COMPLEX)->set("bands", 1));

  VImage indexComplex = xy_complex.rect();
  VImage index = indexComplex.copy(VImage::option()->set("format", VIPS_FORMAT_FLOAT)->set("bands", 2));
  int scale = max(width, height) / width;
  index *= (double)scale / 1.5;
  index += {width / 2.0, height / 2.0};

  return image.mapim(index);
}

ArgumentMap Circle(const string& type, string& outType,
                   const char* bufferdata, size_t bufferLength,
                   [[maybe_unused]] ArgumentMap arguments, size_t& dataSize) {

  VImage in =
      VImage::new_from_buffer(bufferdata, bufferLength, "",
                              GetInputOptions(type, false, false))
          .colourspace(VIPS_INTERPRETATION_sRGB);
  if (!in.has_alpha()) in = in.bandjoin(255);

  int width = in.width();
  int pageHeight = vips_image_get_page_height(in.get_image());
  int nPages = type == "avif" ? 1 : vips_image_get_n_pages(in.get_image());

  try {
    in = NormalizeVips(in, &width, &pageHeight, nPages);
  } catch (int e) {
    if (e == -1) {
      ArgumentMap output;
      output["buf"] = "";
      outType = "frames";
      return output;
    }
  }

  VImage gaussmat =
      VImage::gaussmat(5, 0.2, VImage::option()->set("separable", true)).rot90();

  vector<VImage> img;
  for (int i = 0; i < nPages; i++) {
    VImage img_frame =
        nPages > 1 ? in.crop(0, i * pageHeight, width, pageHeight) : in;
    VImage rectangular =
        toRectangular(img_frame, width, pageHeight);
    rectangular = rectangular.replicate(1, 3)
            .conv(gaussmat,
                  VImage::option()->set("precision", VIPS_PRECISION_INTEGER))
            .crop(0, pageHeight, width, pageHeight);
    VImage polar = toPolar(rectangular, width, pageHeight);
    img.push_back(polar);
  }

  VImage out = VImage::arrayjoin(img, VImage::option()->set("across", 1));

  char* buf;
  out.write_to_buffer(("." + outType).c_str(), reinterpret_cast<void**>(&buf),
                      &dataSize);
  ArgumentMap output;
  output["buf"] = buf;
  return output;
}
