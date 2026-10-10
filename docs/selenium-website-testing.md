# ResQ Selenium website testing

## What the browser suite covers

The Selenium suite runs against the built production frontend in headless Chrome. It checks:

- Home page facility finder and map region render.
- Mobile viewport has no horizontal page overflow.
- Login form, account-role controls, and required inputs.
- Account-type selector and user, hospital, ambulance-provider, and ambulance-driver registration form layouts.
- Client-side password mismatch validation without submitting registration.
- Admin sign-in page.
- Unauthenticated access guards for user, hospital, ambulance driver, provider, and admin routes.
- Unauthorized page and search route render.
- Uncaught browser JavaScript exceptions on the login page.

The suite deliberately does not create accounts, change data, submit an SOS, or accept an ambulance job. Those are destructive/operational actions and need a dedicated isolated staging database plus test identities. This browser suite complements—not replaces—the backend MongoDB integration tests.

## Run locally

Prerequisites: Node.js 22+, Python 3.10+, Google Chrome/Chromium.

```bash
npm ci
npm run build
npm run preview -- --host 127.0.0.1
```

In a second terminal:

```bash
python -m pip install selenium
RESQ_BASE_URL=http://127.0.0.1:4173 python -m unittest discover -s tests/selenium -p 'test_*.py' -v
```

Failure screenshots, current URL, and page HTML are saved under `artifacts/selenium/`.

## Test a deployed staging site

The GitHub Actions workflow supports manual dispatch with the optional `base_url` input. Supply the full staging frontend URL to test that deployment; leave it blank to build and test the current branch's local production preview. Do not point this suite at production if you later add tests that create or mutate records.

## Limits

A green local-preview run confirms frontend route/rendering behavior in a real browser; it does not prove that staging API credentials, MongoDB data, Google Maps keys, GPS permissions, role-specific accounts, or cross-device SOS/dispatch/tracking work correctly. Validate those against staging with controlled test accounts.
