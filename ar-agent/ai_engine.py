from pathlib import Path

from dotenv import load_dotenv
from groq import Groq


load_dotenv(Path(__file__).with_name(".env"))
client = Groq()


def analyze_with_ai(text):
    prompt = f"""
    Analyze this EOB and extract:
    - ICN
    - Balance
    - Denial Codes
    - CPTs

    Then suggest action based on AR workflow.

    EOB:
    {text}
    """

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )

    return response.choices[0].message.content
