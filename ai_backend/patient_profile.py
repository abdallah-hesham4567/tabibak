import os
import json

PROFILE_PATH = os.path.join(os.path.dirname(__file__), "patient_profile.json")

def get_default_profile():
    return {
        "symptoms": [],
        "allergies": [],
        "current_medications": [],
        "medical_conditions": []
    }

def load_profile():
    """Loads the patient profile from the JSON file, or returns default if not exists."""
    if not os.path.exists(PROFILE_PATH):
        return get_default_profile()
    try:
        with open(PROFILE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return get_default_profile()

def save_profile(profile):
    """Saves the patient profile to the JSON file."""
    try:
        with open(PROFILE_PATH, "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=4)
        return True
    except Exception:
        return False

def update_profile(updates):
    """Updates the patient profile with new fields/items and saves it."""
    profile = load_profile()
    for key, value in updates.items():
        if key in profile:
            if isinstance(profile[key], list):
                if isinstance(value, list):
                    for item in value:
                        if item not in profile[key]:
                            profile[key].append(item)
                elif isinstance(value, str):
                    if value not in profile[key]:
                        profile[key].append(value)
            else:
                profile[key] = value
    save_profile(profile)
    return profile
