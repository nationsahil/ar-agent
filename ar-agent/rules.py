def apply_rules(data):
    balance = data.get("balance", 0)
    denial = data.get("denial", "")

    if "PR" in denial:
        return "Patient Billing"

    if "OA-18" in denial:
        return "Adjust"

    if "PI-140" in denial:
        return "Registration"

    if "M44" in denial:
        return "Check SOP for Condition Code"

    if balance > 1000:
        return "Adjustment Queue"

    return "Manual Review"
