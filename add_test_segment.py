import json
import urllib.request
import urllib.error
import sys

def add_test_segment():
    url = "http://localhost:8080/api/segments"
    
    # Matching the Segment type expected by the frontend
    segment_data = {
        "name": "Zugerberg",
        "terrain": "Hilly",
        "distance_km": 6.04,
        "gradient_pct": 7.1,
        "longitude": 8.526036482141343,
        "latitude": 47.170922756264886,
        "completion_times": {
            "beginner": "30:00",
            "intermediate": "25:00",
            "advanced": "20:00"
        },
        "strava_url": "https://www.strava.com/segments/723461",
        "approved": True
    }
    
    print(f"Creating test segment at {url}...")
    
    data = json.dumps(segment_data).encode("utf-8")
    req = urllib.request.Request(
        url, 
        data=data, 
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 201:
                result = json.loads(response.read().decode("utf-8"))
                print("\n✅ Successfully added test segment into the database!")
                print(f"Added ID: {result.get('id')}")
            else:
                print(f"❌ Failed to add. Status code: {response.status}")
                print(response.read().decode("utf-8"))
    except urllib.error.URLError as e:
        print(f"❌ Error connecting to the API: {e}")
        print("Make sure the backend is running and accessible at http://localhost:8080")
        sys.exit(1)

if __name__ == "__main__":
    add_test_segment()
