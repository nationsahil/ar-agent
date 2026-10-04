# AR Agent

AR Agent is a local claims-review workspace for healthcare accounts receivable teams. Upload an EOB PDF, add follow-up context, and receive a structured recommendation for the next action, queue, and billing-system note.

## What it does

- Extracts readable text from an uploaded EOB PDF with `pdfplumber`.
- Sends the EOB text and AR context to Groq for structured analysis.
- Identifies claim details including denial codes, CPT codes, balance, payer, and patient responsibility when present.
- Recommends an AR action, a destination queue, and a billing note.
- Uses the existing routing hints for PR, OA-18, PI-140, M44, and balances above $1,000.

## Run locally

1. Install the Python dependency used for PDF extraction:

   ```bash
   cd ar-agent
   python3 -m pip install -r requirements.txt
   ```

2. Configure Groq:

   ```bash
   cp web/.env.example web/.env.local
   ```

   Add your `GROQ_API_KEY` to `web/.env.local`.

   The app also supports the original local setup in `ar-agent/.env`.

3. Start the web app:

   ```bash
   cd web
   npm install
   npm run dev
   ```

4. Open `http://127.0.0.1:3000`.

## Important

This prototype handles potentially sensitive healthcare information. Do not deploy it with real PHI until authentication, encrypted storage, audit logging, access controls, and a compliance review are in place.
