import cv2
import numpy as np

PREPROCESS_PRESETS = {
    "clean_pdf": {
        "target_width": 2200,
        "clahe_clip": 2.0,
        "use_otsu": True,
    },
    "phone_photo": {
        "target_width": 2600,
        "clahe_clip": 3.5,
        "use_otsu": False,
    },
    "old_scan": {
        "target_width": 2400,
        "clahe_clip": 4.0,
        "use_otsu": True,
    }, 
    "audiveris_compat": {
        "target_width": 2200,
        "clahe_clip": 1.0, 
        "use_otsu": False, 
    }
}

def deskew_image(image):
    inverted = cv2.bitwise_not(image)

    coords = np.column_stack(np.where(inverted > 0))

    if len(coords) == 0:
        return image

    angle = cv2.minAreaRect(coords)[-1]

    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    h, w = image.shape[:2]
    center = (w // 2, h // 2)

    M = cv2.getRotationMatrix2D(center, angle, 1.0)

    rotated = cv2.warpAffine(
        image,
        M,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE
    )

    return rotated

def crop_whitespace(binary_img):

    coords = cv2.findNonZero(255 - binary_img)

    if coords is None:
        return binary_img

    x, y, w, h = cv2.boundingRect(coords)

    padding = 20

    x = max(0, x - padding)
    y = max(0, y - padding)

    return binary_img[y:y+h+padding, x:x+w+padding]

def enhance_music(input_path, output_path, notify, preset="clean_pdf"):

    if preset not in PREPROCESS_PRESETS:
        preset = "clean_pdf"

    config = PREPROCESS_PRESETS[preset]

    notify('Grayscaling image')
    img = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE)

    if img is None:
        raise ValueError("Could not load image")

    #UPSCALE IMG

    height, width = img.shape[:2]

    MIN_WIDTH = 400
    if width < MIN_WIDTH:
        raise RuntimeError(
            f"Image resolution too low ({width}px wide). "
            f"Please upload a higher quality scan or PDF (minimum ~1200px wide, ideally 1800px+). "
            f"If scanning from a phone, ensure good lighting and hold the camera steady."
        )


    target_width = config["target_width"]

    if width < target_width * 0.75:
        scale_factor = target_width / width
        img = cv2.resize(
            img,
            (int(width * scale_factor), int(height * scale_factor)),
            interpolation=cv2.INTER_CUBIC
        )
        notify(f'Upscaled from {width}px to {int(width * scale_factor)}px')
        print(f"Upscaled from {width}px to {int(width * scale_factor)}px")
    else:
        notify(f"Image already {width}px wide, skipping upscale")
        print(f"Image already {width}px wide, skipping upscale")

    #CONTRAST BOOST
    notify("Boosting image contrast")
    clahe = cv2.createCLAHE(clipLimit=1.0, tileGridSize=(16, 16))
    img = clahe.apply(img)

    #LIGHT DENOISE 
    notify("Deblurring image")
    img = cv2.GaussianBlur(img, (3, 3), 0)

    #BIANIRISE
    notify("Bianirising image")
    if preset == "phone_photo" or preset == "old_scan":
        img = cv2.GaussianBlur(img, (3, 3), 0)
        if config["use_otsu"]:
            _, img = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        else:
            img = cv2.adaptiveThreshold(
                img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY, 21, 8
            )

    #DESKEW
    notify("Deskewing image")
    if preset == "phone_photo":
        img = deskew_image(img)

    #CROP
    #binary = crop_whitespace(binary)

    cv2.imwrite(output_path, img)

    return output_path

