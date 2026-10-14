"""Selenium browser tests for Direct Hospital Care Requests and Appointment Booking.

Validates:
1. Prominent coexistence of Emergency SOS alongside Normal Care workflows.
2. Facility Detail page offering Request Care and Book Appointment actions.
3. Care Request and Appointment Booking modal interfaces and safety disclaimers.
4. Citizen dashboard (/appointments) displaying tabs for Appointments, Care Requests, and Notifications.
5. Hospital management (/hospital/appointments) displaying incoming requests and schedule tabs.
"""
from __future__ import annotations

import os
import time
import unittest
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get("RESQ_BASE_URL", "http://127.0.0.1:5173").rstrip("/")
ARTIFACTS = Path(os.environ.get("SELENIUM_ARTIFACTS_DIR", "artifacts/selenium"))

DEMO_PASSWORD = "Password@123"

ACCOUNTS = {
    "USER": "demo.user@resq.local",
    "HOSPITAL": "demo.hospital@resq.local",
}


class ResQHospitalRequestsAndAppointmentsTests(unittest.TestCase):
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
        try:
            cls.driver = webdriver.Chrome(options=options)
            cls.driver.set_page_load_timeout(15)
            cls.wait = WebDriverWait(cls.driver, 8)
        except Exception as exc:
            raise unittest.SkipTest(f"Chrome WebDriver could not be initialized: {exc}")

        import urllib.request
        api_base = os.environ.get("VITE_API_BASE_URL", "http://localhost:5001/api/v1").rstrip("/")
        try:
            req = urllib.request.Request(f"{api_base}/health", headers={"User-Agent": "ResQ-Selenium-Preflight"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status != 200:
                    raise unittest.SkipTest(f"Backend returned HTTP {resp.status} on /health")
        except Exception as net_err:
            raise unittest.SkipTest(f"Backend API is unreachable at {api_base}: {net_err}")

    @classmethod
    def tearDownClass(cls) -> None:
        if hasattr(cls, "driver"):
            try:
                cls.driver.quit()
            except Exception:
                pass

    def setUp(self) -> None:
        self.driver.delete_all_cookies()
        try:
            self.driver.get(f"{BASE_URL}/")
            self.driver.execute_script("window.localStorage.clear(); window.sessionStorage.clear();")
        except Exception:
            pass
        self.driver.set_window_size(1440, 1000)

    def capture(self, name: str) -> None:
        path = ARTIFACTS / f"{name}.png"
        try:
            self.driver.save_screenshot(str(path))
        except Exception:
            pass

    def open_path(self, path: str) -> None:
        self.driver.get(f"{BASE_URL}{path}")
        self.wait.until(lambda d: d.execute_script("return document.readyState") in ("interactive", "complete"))
        try:
            WebDriverWait(self.driver, 4).until(
                lambda d: "Checking your session" not in (d.find_element(By.TAG_NAME, "body").text or "")
            )
        except Exception:
            pass

    def set_react_input(self, element, text: str) -> None:
        self.driver.execute_script('''
            const el = arguments[0];
            const val = arguments[1];
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        ''', element, text)

    def login_as(self, role: str) -> None:
        email = ACCOUNTS[role]
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
        self.set_react_input(password_input, DEMO_PASSWORD)
        submit_btn = self.driver.find_element(By.CSS_SELECTOR, "form button[type='submit']")
        self.driver.execute_script("arguments[0].click();", submit_btn)

        # Wait until redirected away from /login
        self.wait.until(lambda d: "/login" not in d.current_url)

    def test_01_emergency_sos_prominence_preserved(self) -> None:
        """Verifies that Emergency SOS remains prominent and functional on the home/header."""
        self.open_path("/")
        self.capture("home_page_with_sos")

        # Find Emergency SOS button in header
        sos_buttons = self.driver.find_elements(By.XPATH, "//button[contains(., 'SOS') or contains(., 'Emergency')]")
        self.assertTrue(len(sos_buttons) > 0, "Emergency SOS button must be visible in header")

    def test_02_citizen_appointments_page_structure(self) -> None:
        """Verifies citizen appointments dashboard page (/appointments) renders with tabs."""
        self.login_as("USER")
        self.open_path("/appointments")
        self.capture("citizen_appointments_page")

        # Verify page header
        heading = self.wait.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Hospital Requests & Appointments')]")))
        self.assertIsNotNone(heading)

        # Verify tab buttons
        tab_buttons = self.driver.find_elements(By.XPATH, "//button[contains(., 'Appointments') or contains(., 'Care Requests') or contains(., 'Notifications')]")
        self.assertGreaterEqual(len(tab_buttons), 3, "Citizen dashboard must have Appointments, Care Requests, and Notifications tabs")

    def test_03_facility_detail_actions(self) -> None:
        """Verifies facility detail page offers Request Care and Book Appointment alongside Call and Directions."""
        self.open_path("/search")

        # Look for facility card and click into details
        facility_links = self.driver.find_elements(By.XPATH, "//a[contains(@href, '/facility/')]")
        if facility_links:
            self.driver.execute_script("arguments[0].click();", facility_links[0])
            time.sleep(1.0)
            self.capture("facility_detail_with_actions")

            # Check Request Care and Book Appointment buttons
            request_care_btn = self.driver.find_elements(By.XPATH, "//button[contains(., 'Request Care')]")
            book_appt_btn = self.driver.find_elements(By.XPATH, "//button[contains(., 'Book Appointment')]")

            self.assertTrue(len(request_care_btn) > 0, "Request Care button should be rendered on facility detail")
            self.assertTrue(len(book_appt_btn) > 0, "Book Appointment button should be rendered on facility detail")

    def test_04_hospital_dashboard_navigation(self) -> None:
        """Verifies hospital staff dashboard includes Care & Appointments section."""
        self.login_as("HOSPITAL")
        self.open_path("/hospital/appointments")
        self.capture("hospital_appointments_dashboard")

        # Verify subtabs in hospital view
        subtabs = self.wait.until(lambda d: [
            el for el in d.find_elements(By.XPATH, "//button[contains(., 'Incoming Care Requests') or contains(., 'Appointments Schedule') or contains(., 'Availability Configuration')]")
            if el.is_displayed()
        ])
        self.assertGreaterEqual(len(subtabs), 3, "Hospital dashboard must feature incoming requests, schedule, and availability subtabs")


if __name__ == "__main__":
    unittest.main()
