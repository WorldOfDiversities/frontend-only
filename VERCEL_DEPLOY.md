# Deploy FRONTEND to Vercel

This guide assumes the GitHub repository contains only frontend files at the repository root.

## 1. Push code

Push this repository to GitHub.

## 2. Create Vercel project

1. Go to Vercel dashboard.
2. Click New Project and import your GitHub repository.
3. In project settings:
   - Framework Preset: Other
   - Root Directory: .
   - Build Command: (leave empty)
   - Output Directory: .
4. Deploy.

## 3. Confirm routes

After deploy, these should open successfully:

- /
- /what
- /login
- /register
- /forgot-password
- /reset-password

## 4. Connect backend API

Your frontend uses API base URL from app-config.

If frontend and backend are on different domains, set this in app-config.js:

window.POS_API_BASE_URL = "https://YOUR_BACKEND_DOMAIN/api/v1";

Or keep current auto behavior for localhost testing.

## 5. Update backend for this frontend domain

Set backend environment variables:

- DJANGO_CORS_ALLOWED_ORIGINS=https://YOUR_VERCEL_DOMAIN
- DJANGO_CSRF_TRUSTED_ORIGINS=https://YOUR_VERCEL_DOMAIN
- FRONTEND_URL=https://YOUR_VERCEL_DOMAIN
- PASSWORD_RESET_URL_TEMPLATE=https://YOUR_VERCEL_DOMAIN/reset-password.html?token={token}

## 6. Redeploy backend

Restart/redeploy backend after updating environment variables.
