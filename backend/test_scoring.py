from agents.risk_intelligence import score_all_suppliers
import logging

logging.basicConfig(level=logging.INFO)

print("Starting manual supplier scoring...")
results = score_all_suppliers()
print("Done.")
