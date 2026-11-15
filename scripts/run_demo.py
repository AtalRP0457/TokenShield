import requests
B = "http://localhost:8000/api"
print(requests.post(f"{B}/simulation/trigger", params={"scenario": "healthy"}).json())
print(requests.post(f"{B}/simulation/trigger", params={"scenario": "repeating"}).json())
print("Watch GET /api/incidents and /api/metrics/overview")
