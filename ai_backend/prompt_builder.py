from patient_profile import load_profile

SYSTEM_PROMPT = """You are a medical triage assistant.
Ask concise follow-up questions.
Never assume missing information.
Ask at most two questions.
Do not diagnose immediately.
"""

def build_prompt(user_message: str) -> list:
    """
    Builds a list of message dictionaries (role/content) suitable for the LLM API,
    incorporating the patient profile as context.
    """
    profile = load_profile()
    
    # Format profile details if any exist
    profile_details = []
    if profile.get("symptoms"):
        profile_details.append(f"- Known Symptoms: {', '.join(profile['symptoms'])}")
    if profile.get("allergies"):
        profile_details.append(f"- Allergies: {', '.join(profile['allergies'])}")
    if profile.get("current_medications"):
        profile_details.append(f"- Current Medications: {', '.join(profile['current_medications'])}")
    if profile.get("medical_conditions"):
        profile_details.append(f"- Medical Conditions: {', '.join(profile['medical_conditions'])}")
    
    context = ""
    if profile_details:
        context = "Current Patient Profile Context:\n" + "\n".join(profile_details) + "\n\n"
        
    full_system_prompt = SYSTEM_PROMPT
    if context:
        full_system_prompt += f"\n{context}"
        
    messages = [
        {"role": "system", "content": full_system_prompt},
        {"role": "user", "content": user_message}
    ]
    return messages
