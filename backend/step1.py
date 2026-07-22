from database import get_client

client = get_client()

print("--- supplier_risk_scores ORDER BY computed_at DESC LIMIT 10 ---")
res = client.table("supplier_risk_scores").select("*").order("computed_at", desc=True).limit(10).execute()
import json
print(json.dumps(res.data, indent=2))

print("\n--- COUNT(*) FROM supplier_risk_scores ---")
res = client.table("supplier_risk_scores").select("*", count="exact").limit(1).execute()
print(res.count)

print("\n--- COUNT(*) FROM events ---")
res = client.table("events").select("*", count="exact").limit(1).execute()
print(res.count)

print("\n--- COUNT(*) FROM sanctions ---")
res = client.table("sanctions").select("*", count="exact").limit(1).execute()
print(res.count)
