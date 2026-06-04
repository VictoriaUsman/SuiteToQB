# AccountingSuite - Windows Setup Script
Write-Host "=== AccountingSuite Setup ===" -ForegroundColor Cyan

# Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Python not found. Install Python 3.11+ from https://python.org" -ForegroundColor Red
    exit 1
}

# Check Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/4] Setting up Python virtual environment..." -ForegroundColor Yellow
Set-Location "backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

Write-Host "`n[2/4] Copying environment template..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  -> Created backend/.env - EDIT THIS FILE with your API keys before running!" -ForegroundColor Green
} else {
    Write-Host "  -> backend/.env already exists, skipping" -ForegroundColor Gray
}

Set-Location ".."

Write-Host "`n[3/4] Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location "frontend"
npm install
Set-Location ".."

Write-Host "`n[4/4] Done!" -ForegroundColor Green
Write-Host @'

Next steps:
  1. Edit backend/.env and set:
       OPENAI_API_KEY=sk-...
       QB_CLIENT_ID=...
       QB_CLIENT_SECRET=...
       APP_SECRET_KEY=<any random 32-char string>

  2. Start the backend:
       cd backend
       .\.venv\Scripts\Activate.ps1
       uvicorn main:app --reload

  3. Start the frontend (new terminal):
       cd frontend
       npm run dev

  4. Open http://localhost:5173 in your browser

  QuickBooks setup:
    - Go to https://developer.intuit.com and create an app
    - Set redirect URI to: http://localhost:8000/api/quickbooks/callback
    - Copy your Client ID and Client Secret to backend/.env
'@
