import json
import urllib.request
import urllib.error
import sys

def add_test_segment():
    url = "http://localhost:8080/api/segments"
    
    # Using the new workflow: provide strava_url and let the backend fetch details
    segment_data = {
        "strava_url": "https://www.strava.com/segments/723461",
        "terrain": "Hilly"
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
