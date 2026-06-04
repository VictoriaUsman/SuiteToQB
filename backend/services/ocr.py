import io
import os
from pathlib import Path
import pytesseract
import fitz  # PyMuPDF
from PIL import Image
import openpyxl
import pandas as pd
from config import get_settings

settings = get_settings()

if settings.tesseract_cmd != "tesseract":
    pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd


def extract_text_from_pdf(file_path: str) -> str:
    doc = fitz.open(file_path)
    pages_text = []
    for page in doc:
        text = page.get_text()
        if len(text.strip()) < 50:
            # Likely a scanned page — use OCR
            pix = page.get_pixmap(dpi=300)
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            text = pytesseract.image_to_string(img, config="--psm 6")
        pages_text.append(text)
    doc.close()
    return "\n\n--- PAGE BREAK ---\n\n".join(pages_text)


def extract_text_from_image(file_path: str) -> str:
    img = Image.open(file_path)
    return pytesseract.image_to_string(img, config="--psm 6")


def extract_text_from_excel(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    if ext == ".csv":
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path)
    return df.to_string(index=False)


def extract_raw_text(file_path: str, file_type: str) -> str:
    file_type = file_type.lower()
    if file_type == "pdf":
        return extract_text_from_pdf(file_path)
    elif file_type in ("xlsx", "xls", "csv"):
        return extract_text_from_excel(file_path)
    elif file_type in ("png", "jpg", "jpeg", "tiff", "bmp"):
        return extract_text_from_image(file_path)
    raise ValueError(f"Unsupported file type: {file_type}")
