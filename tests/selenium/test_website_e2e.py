"""Selenium browser smoke and navigation tests for the ResQ web frontend.

These tests avoid creating records or submitting real emergency requests. They validate
public UI, registration validation, responsive layout, and unauthenticated route guards.
Set RESQ_BASE_URL to test a deployed staging URL instead of the local Vite preview.
"""
from __future__ import annotations

import os
import time
import unittest
from pathlib import Path
from urllib.parse import urlparse

from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


BASE_URL = os.environ.get("RESQ_BASE_URL", "http://127.0.0.1:4173").rstrip("/")
ARTIFACTS = Path(os.environ.get("SELENIUM_ARTIFACTS_DIR", "artifacts/selenium"))


class ResQWebsiteE2ETests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        options = webdriver.ChromeOptions()
        options.page_load_strategy = "eager"
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1440,1000")
        options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
        cls.driver = webdriver.Chrome(options=options)
        cls.driver.set_page_load_timeout(20)
        cls.wait = WebDriverWait(cls.driver, 12)

    @classmethod
    def tearDownClass(cls) -> None:
        if hasattr(cls, "driver"):
            cls.driver.quit()

    def setUp(self) -> None:
        self.driver.delete_all_cookies()
        self.driver.set_window_size(1440, 1000)

    def open_path(self, path: str) -> None:
        self.driver.get(f"{BASE_URL}{path}")
        self.wait.until(lambda d: d.execute_script("return document.readyState") in ("interactive", "complete"))

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
        except WebDriverException:
            pass

    def run(self, result=None):
        outcome = super().run(result)
        if result is not None and result.errors + result.failures:
            if any(test is self for test, _ in result.errors + result.failures):
                self.save_failure_artifacts()
        return outcome

    def test_homepage_renders_facility_finder_and_map_region(self) -> None:
        self.open_path("/")
        self.assert_page_not_blank()
        self.assertTrue(
            self.driver.find_elements(By.CSS_SELECTOR, '[aria-label="Healthcare facilities finder"]'),
            "Desktop facility finder region is missing",
        )
        self.assertTrue(
            self.driver.find_elements(By.CSS_SELECTOR, 'input[placeholder*="Search hospitals"]'),
            "Hospital search input is missing",
        )
        self.assertTrue(
            self.driver.find_elements(By.CSS_SELECTOR, '[aria-label="Map view"]'),
            "Map region is missing",
        )

    def test_homepage_is_responsive_without_horizontal_overflow(self) -> None:
        self.driver.set_window_size(390, 844)
        self.open_path("/")
        self.assert_page_not_blank()
        dimensions = self.driver.execute_script(
            "return {width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth}"
        )
        self.assertLessEqual(
            dimensions["scroll"], dimensions["width"] + 2,
            f"Mobile page overflows horizontally: {dimensions}",
        )

    def test_login_page_has_accessible_role_choices_and_required_fields(self) -> None:
        self.open_path("/login")
        self.assert_page_not_blank()
        self.assertEqual("Sign in", self.driver.find_element(By.TAG_NAME, "h1").text)
        for role in ("User", "Hospital", "Ambulance Provider", "Ambulance Driver"):
            self.assertTrue(self.driver.find_elements(By.XPATH, f"//button[normalize-space()='{role}']"))
        self.assertTrue(self.driver.find_elements(By.CSS_SELECTOR, 'input[type="email"][required]'))
        self.assertTrue(self.driver.find_elements(By.CSS_SELECTOR, 'input[type="password"][required]'))
        self.assertTrue(self.driver.find_elements(By.XPATH, "//a[contains(., 'Create an account')]"))

    def test_login_role_switch_updates_pressed_state(self) -> None:
        self.open_path("/login")
        hospital = self.driver.find_element(By.XPATH, "//button[normalize-space()='Hospital']")
        hospital.click()
        self.assertEqual("true", hospital.get_attribute("aria-pressed"))
        user = self.driver.find_element(By.XPATH, "//button[normalize-space()='User']")
        user.click()
        self.assertEqual("true", user.get_attribute("aria-pressed"))

    def test_registration_role_picker_lists_all_four_account_types(self) -> None:
        self.open_path("/register")
        self.assertEqual("Choose your ResQ account type", self.driver.find_element(By.TAG_NAME, "h1").text)
        for text in ("Patient / User", "Ambulance Provider", "Ambulance Driver", "Hospital"):
            self.assertTrue(self.driver.find_elements(By.XPATH, f"//a[.//span[normalize-space()='{text}']]"))

    def test_user_registration_rejects_mismatched_passwords_without_api_mutation(self) -> None:
        self.open_path("/register/user")
        self.assertEqual("Create your ResQ account", self.driver.find_element(By.TAG_NAME, "h1").text)
        inputs = self.driver.find_elements(By.CSS_SELECTOR, "form input")
        self.assertGreaterEqual(len(inputs), 5)
        values = ["Selenium Test User", "selenium.user@example.invalid", "9876543210", "SafeTestPass123", "DifferentPass123"]
        for element, value in zip(inputs[:5], values):
            element.send_keys(value)
        self.driver.find_element(By.CSS_SELECTOR, "form button[type='submit']").click()
        alert = self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="alert"]')))
        self.assertIn("Passwords do not match", alert.text)

    def test_hospital_registration_form_renders_required_operational_fields(self) -> None:
        self.open_path("/hospital/register")
        self.assertEqual("Register your hospital", self.driver.find_element(By.TAG_NAME, "h1").text)
        for label in ("Hospital name", "Email", "Phone", "Registration number", "Hospital type"):
            self.assertTrue(self.driver.find_elements(By.XPATH, f"//label[.//span[normalize-space()='{label}']]"))

    def test_ambulance_provider_registration_form_renders(self) -> None:
        self.open_path("/ambulance-provider/register")
        self.assertEqual("Register an ambulance provider", self.driver.find_element(By.TAG_NAME, "h1").text)
        self.assertTrue(self.driver.find_elements(By.XPATH, "//label[.//span[normalize-space()='Registration number']]"))
        self.assertTrue(self.driver.find_elements(By.XPATH, "//label[.//span[normalize-space()='Service type']]"))

    def test_ambulance_driver_registration_form_renders(self) -> None:
        self.open_path("/ambulance-driver/register")
        self.assertEqual("Register as an ambulance driver", self.driver.find_element(By.TAG_NAME, "h1").text)
        for label in ("Full name", "License number", "Provider ID"):
            self.assertTrue(self.driver.find_elements(By.XPATH, f"//label[.//span[normalize-space()='{label}']]"))

    def test_admin_login_page_renders_admin_sign_in(self) -> None:
        self.open_path("/admin/login")
        self.assertEqual("Admin sign in", self.driver.find_element(By.TAG_NAME, "h1").text)
        self.assertTrue(self.driver.find_elements(By.CSS_SELECTOR, 'input[type="email"][required]'))
        self.assertTrue(self.driver.find_elements(By.CSS_SELECTOR, 'input[type="password"][required]'))

    def test_user_protected_routes_redirect_unauthenticated_visitors_to_login(self) -> None:
        for path in ("/sos", "/saved", "/profile"):
            with self.subTest(path=path):
                self.open_path(path)
                self.wait.until(lambda d: urlparse(d.current_url).path == "/login")
                self.assertEqual("/login", urlparse(self.driver.current_url).path)

    def test_hospital_route_redirects_unauthenticated_visitors_to_login(self) -> None:
        self.open_path("/hospital")
        self.wait.until(lambda d: urlparse(d.current_url).path == "/login")
        self.assertEqual("/login", urlparse(self.driver.current_url).path)

    def test_driver_route_redirects_unauthenticated_visitors_to_login(self) -> None:
        self.open_path("/ambulance")
        self.wait.until(lambda d: urlparse(d.current_url).path == "/login")
        self.assertEqual("/login", urlparse(self.driver.current_url).path)

    def test_provider_route_redirects_unauthenticated_visitors_to_login(self) -> None:
        self.open_path("/ambulance-provider")
        self.wait.until(lambda d: urlparse(d.current_url).path == "/login")
        self.assertEqual("/login", urlparse(self.driver.current_url).path)

    def test_admin_route_redirects_unauthenticated_visitors_to_login(self) -> None:
        self.open_path("/admin")
        self.wait.until(lambda d: urlparse(d.current_url).path == "/login")
        self.assertEqual("/login", urlparse(self.driver.current_url).path)

    def test_unauthorized_page_renders_access_denied_message(self) -> None:
        self.open_path("/unauthorized")
        self.assertEqual("Access denied", self.driver.find_element(By.TAG_NAME, "h1").text)
        self.assertTrue(self.driver.find_elements(By.XPATH, "//a[contains(., 'Return to ResQ')]"))

    def test_search_page_route_loads_without_blank_screen(self) -> None:
        self.open_path("/search")
        self.assert_page_not_blank()

    def test_client_runtime_does_not_emit_uncaught_javascript_exceptions(self) -> None:
        self.open_path("/login")
        time.sleep(0.5)
        errors = [
            entry["message"]
            for entry in self.driver.get_log("browser")
            if entry.get("level") == "SEVERE"
            and any(term in entry.get("message", "").lower() for term in ("uncaught", "referenceerror", "typeerror"))
        ]
        self.assertEqual([], errors, "Uncaught browser JavaScript errors: " + " | ".join(errors))


if __name__ == "__main__":
    unittest.main(verbosity=2)
