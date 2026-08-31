import bleach

def sanitize_text(input_string: str) -> str:
    if not input_string:
        return input_string
    # Allow absolutely no HTML tags
    return bleach.clean(input_string, tags=[], attributes={}, strip=True)
