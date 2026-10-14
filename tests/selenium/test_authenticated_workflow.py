"""Selenium authenticated role and end-to-end workflow tests for ResQ.

Validates authenticated role flows, session persistence, role guards,
hospital emergency management view, driver duty console, and error states.
Uses the verified demo accounts seeded in the ResQ environment.
"""
from __future__ import annotations

import os
import time
import unittest
from pathlib import Path
from urllib.parse import urlparse

from selenium import webdriver
from selenium.common.exceptions import WebDriverException, TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get("RESQ_BASE_URL", "http://127.0.0.1:5173").rstrip("/")
ARTIFACTS = Path(os.environ.get("SELENIUM_ARTIFACTS_DIR", "artifacts/selenium"))

DEMO_PASSWORD = "Password@123"
ADMIN_PASSWORD = "Shubh@m2006734013"

ACCOUNTS = {
    "USER": "demo.user@resq.local",
    "HOSPITAL": "demo.hospital@resq.local",
    "AMBULANCE_DRIVER": "demo.driver@resq.local",
    "AMBULANCE_PROVIDER": "demo.provider@resq.local",
    "ADMIN": "admin@resq.local",
}


class ResQAuthenticatedWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        options = webdriver.ChromeOptions()
        chrome_binary = os.environ.get("CHROME_BIN")
        if chrome_binary:
            options.binary_location = chrome_binary
        options.page_load_strategy = "eager"
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1440,1000")
        options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
        try:
            cls.driver = webdriver.Chrome(options=options)
            cls.driver.set_page_load_timeout(15)
            cls.wait = WebDriverWait(cls.driver, 8)
        except Exception as exc:
            raise unittest.SkipTest(f"Chrome WebDriver could not be initialized: {exc}")

        import urllib.request
        api_base = os.environ.get("VITE_API_BASE_URL", "http://localhost:5001/api/v1").rstrip("/")
        try:
            req = urllib.request.Request(f"{api_base}/health", headers={"User-Agent": "ResQ-Test"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                pass
        except Exception as exc:
            if hasattr(cls, "driver"):
                cls.driver.quit()
            raise unittest.SkipTest(f"ResQ backend API is not available at {api_base}: {exc}")

    @classmethod
    def tearDownClass(cls) -> None:
        if hasattr(cls, "driver"):
            cls.driver.quit()

    def setUp(self) -> None:
        self.driver.delete_all_cookies()
        try:
            self.driver.execute_script("window.localStorage.clear(); window.sessionStorage.clear();")
        except Exception:
            pass
        self.driver.set_window_size(1440, 1000)

    def open_path(self, path: str) -> None:
        self.driver.get(f"{BASE_URL}{path}")
        self.wait.until(lambda d: d.execute_script("return document.readyState") in ("interactive", "complete"))
        try:
            WebDriverWait(self.driver, 4).until(
                lambda d: "Checking your session" not in (d.find_element(By.TAG_NAME, "body").text or "")
            )
        except Exception:
            pass

    def assert_page_not_blank(self) -> None:
        body = self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        self.assertTrue(body.text.strip(), f"Blank page at {self.driver.current_url}")
        self.assertIsNotNone(self.driver.find_element(By.CSS_SELECTOR, "#root"))

    def save_failure_artifacts(self) -> None:
        safe_name = self.id().replace(".", "_").replace("/", "_")
        try:
            self.driver.save_screenshot(str(ARTIFACTS / f"{safe_name}.png"))
            (ARTIFACTS / f"{safe_name}.html").write_text(
                self.driver.page_source, encoding="utf-8"
            )
            (ARTIFACTS / f"{safe_name}.url.txt").write_text(
                self.driver.current_url, encoding="utf-8"
            )
        except (WebDriverException, OSError):
            pass

    def run(self, result=None):
        outcome = super().run(result)
        if result is not None and result.errors + result.failures:
            if any(test is self for test, _ in result.errors + result.failures):
                self.save_failure_artifacts()
        return outcome

    def set_react_input(self, element, text: str) -> None:
        self.driver.execute_script('''
            const el = arguments[0];
            const val = arguments[1];
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        ''', element, text)

    def login_as(self, role: str, email: str, password: str, is_admin: bool = False) -> None:
        if is_admin:
            self.open_path("/admin/login")
        else:
            self.open_path("/login")
            role_labels = {
                "USER": "User",
                "HOSPITAL": "Hospital",
                "AMBULANCE_PROVIDER": "Ambulance Provider",
                "AMBULANCE_DRIVER": "Ambulance Driver",
            }
            label = role_labels.get(role, "User")
            role_btn = self.wait.until(EC.element_to_be_clickable((By.XPATH, f"//button[normalize-space()='{label}']")))
            self.driver.execute_script("arguments[0].click();", role_btn)
            self.wait.until(lambda d: role_btn.get_attribute("aria-pressed") == "true")

        email_input = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'input[type="email"]')))
        password_input = self.driver.find_element(By.CSS_SELECTOR, 'input[type="password"]')
        self.set_react_input(email_input, email)
        self.set_react_input(password_input, password)
        submit_btn = self.driver.find_element(By.CSS_SELECTOR, "form button[type='submit']")
        self.driver.execute_script("arguments[0].click();", submit_btn)

    def test_login_rejects_invalid_password_with_accessible_alert(self) -> None:
        self.open_path("/login")
        self.assert_page_not_blank()
        self.login_as("USER", ACCOUNTS["USER"], "IncorrectPassword999!")
        alert = self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="alert"]')))
        self.assertIn("Invalid", alert.text)

    def test_user_login_and_authenticated_profile(self) -> None:
        self.login_as("USER", ACCOUNTS["USER"], DEMO_PASSWORD)
        self.wait.until(lambda d: urlparse(d.current_url).path != "/login")
        self.open_path("/profile")
        self.assert_page_not_blank()
        self.wait.until(
            lambda d: any(name in d.find_element(By.TAG_NAME, "body").text for name in ("Citizen", "Shubham", "demo.user@resq.local"))
        )

    def test_user_session_persists_across_page_refresh(self) -> None:
        self.login_as("USER", ACCOUNTS["USER"], DEMO_PASSWORD)
        self.wait.until(lambda d: urlparse(d.current_url).path != "/login")
        self.open_path("/profile")
        self.assert_page_not_blank()
        self.wait.until(
            lambda d: any(name in d.find_element(By.TAG_NAME, "body").text for name in ("Citizen", "Shubham", "demo.user@resq.local"))
        )
        self.driver.refresh()
        self.wait.until(lambda d: d.execute_script("return document.readyState") in ("interactive", "complete"))
        try:
            WebDriverWait(self.driver, 4).until(
                lambda d: "Checking your session" not in (d.find_element(By.TAG_NAME, "body").text or "")
            )
        except Exception:
            pass
        self.assertNotEqual("/login", urlparse(self.driver.current_url).path)
        self.wait.until(
            lambda d: any(name in d.find_element(By.TAG_NAME, "body").text for name in ("Citizen", "Shubham", "demo.user@resq.local"))
        )

    def test_hospital_login_and_emergencies_view(self) -> None:
        self.login_as("HOSPITAL", ACCOUNTS["HOSPITAL"], DEMO_PASSWORD)
        self.wait.until(lambda d: urlparse(d.current_url).path != "/login")
        self.open_path("/hospital/emergencies")
        self.assert_page_not_blank()
        self.wait.until(
            lambda d: any(term in d.find_element(By.TAG_NAME, "body").text.lower() for term in ("hospital", "emergenc", "patient", "intake", "coordination", "active"))
        )

    def test_ambulance_driver_login_and_duty_interface(self) -> None:
        self.login_as("AMBULANCE_DRIVER", ACCOUNTS["AMBULANCE_DRIVER"], DEMO_PASSWORD)
        self.wait.until(lambda d: urlparse(d.current_url).path != "/login")
        self.assert_page_not_blank()
        self.wait.until(
            lambda d: any(term in d.find_element(By.TAG_NAME, "body").text.lower() for term in ("duty", "ambulance", "trip", "rj-14"))
        )

    def test_admin_login_and_dashboard_access(self) -> None:
        self.login_as("ADMIN", ACCOUNTS["ADMIN"], ADMIN_PASSWORD, is_admin=True)
        self.wait.until(lambda d: urlparse(d.current_url).path != "/admin/login")
        self.assert_page_not_blank()
        self.wait.until(
            lambda d: any(term in d.find_element(By.TAG_NAME, "body").text.lower() for term in ("admin", "operations", "system", "overview", "users"))
        )

    def test_role_guard_blocks_user_from_accessing_admin_portal(self) -> None:
        self.login_as("USER", ACCOUNTS["USER"], DEMO_PASSWORD)
        self.wait.until(lambda d: urlparse(d.current_url).path != "/login")
        self.open_path("/admin")
        self.wait.until(lambda d: urlparse(d.current_url).path in ("/unauthorized", "/login", "/admin/login", "/"))

    def test_ambulance_provider_login_and_dashboard(self) -> None:
        self.login_as("AMBULANCE_PROVIDER", ACCOUNTS["AMBULANCE_PROVIDER"], DEMO_PASSWORD)
        self.wait.until(lambda d: urlparse(d.current_url).path != "/login")
        self.wait.until(lambda d: "provider" in urlparse(d.current_url).path.lower())
        self.assert_page_not_blank()
        self.wait.until(
            lambda d: any(term in d.find_element(By.TAG_NAME, "body").text.lower() for term in ("fleet", "provider", "ambulances", "drivers", "request queue"))
        )

    def test_admin_reports_and_analytics_views(self) -> None:
        self.login_as("ADMIN", ACCOUNTS["ADMIN"], ADMIN_PASSWORD, is_admin=True)
        self.wait.until(lambda d: urlparse(d.current_url).path != "/admin/login")
        self.open_path("/admin/reports")
        self.assert_page_not_blank()
        self.wait.until(
            lambda d: any(term in d.find_element(By.TAG_NAME, "body").text.lower() for term in ("reports", "export csv", "date range", "overview"))
        )
        self.open_path("/admin/analytics")
        self.assert_page_not_blank()
        self.wait.until(
            lambda d: any(term in d.find_element(By.TAG_NAME, "body").text.lower() for term in ("analytics", "resolution", "hospital", "fleet"))
        )

    def test_user_saved_facilities_view(self) -> None:
        self.login_as("USER", ACCOUNTS["USER"], DEMO_PASSWORD)
        self.wait.until(lambda d: urlparse(d.current_url).path != "/login")
        self.open_path("/saved")
        self.assert_page_not_blank()
        self.wait.until(
            lambda d: any(term in d.find_element(By.TAG_NAME, "body").text.lower() for term in ("saved", "facilities", "hospital", "access"))
        )

    def test_hospital_patients_and_profile_views(self) -> None:
        self.login_as("HOSPITAL", ACCOUNTS["HOSPITAL"], DEMO_PASSWORD)
        self.wait.until(lambda d: urlparse(d.current_url).path != "/login")
        self.open_path("/hospital/patients")
        self.assert_page_not_blank()
        self.wait.until(
            lambda d: any(term in d.find_element(By.TAG_NAME, "body").text.lower() for term in ("patient", "coordination", "cases", "incoming"))
        )
        self.open_path("/hospital/profile")
        self.assert_page_not_blank()
        self.wait.until(
            lambda d: any(term in d.find_element(By.TAG_NAME, "body").text.lower() for term in ("profile", "trauma", "sms", "services"))
        )



if __name__ == "__main__":
    unittest.main(verbosity=2)
