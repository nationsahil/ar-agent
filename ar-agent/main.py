from parser import extract_text_from_pdf
from ai_engine import analyze_with_ai


file_path = "sample_eob.pdf"

text = extract_text_from_pdf(file_path)

result = analyze_with_ai(text)

print("\n===== ANALYSIS =====\n")
print(result)
