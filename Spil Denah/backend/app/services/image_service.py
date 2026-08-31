import io
from PIL import Image

def optimize_image(file_bytes: bytes, max_width: int = 4096) -> tuple[bytes, int, int]:
    try:
        img = Image.open(io.BytesIO(file_bytes))
        
        # Strip EXIF metadata for privacy (usually handled by simply re-saving or creating a new image)
        data = list(img.getdata())
        image_without_exif = Image.new(img.mode, img.size)
        image_without_exif.putdata(data)
        img = image_without_exif
        
        width, height = img.size
        
        if width > max_width:
            ratio = max_width / width
            new_height = int(height * ratio)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
            width, height = img.size
            
        output = io.BytesIO()
        try:
            img.save(output, format="WebP", quality=80)
        except Exception:
            # Fallback to JPEG if WebP fails or is not supported for this mode
            img = img.convert("RGB")
            img.save(output, format="JPEG", quality=80)
            
        return output.getvalue(), width, height
    except Exception as e:
        raise ValueError(f"Invalid image file: {str(e)}")
