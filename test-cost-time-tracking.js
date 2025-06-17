// Test script to verify cost-time tracking functionality
const testCostTimeTracking = async () => {
  try {
    // Test 1: Create a time entry by hours
    const timeEntry = {
      projectId: 1,
      personnelId: 1,
      date: new Date().toISOString(),
      hours: 8,
      description: "Test time entry by hours",
      entryType: "hours"
    };

    const response1 = await fetch('http://localhost:5000/api/time-entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(timeEntry)
    });

    if (response1.ok) {
      const result1 = await response1.json();
      console.log('✓ Time entry by hours created:', result1);
    } else {
      console.error('✗ Failed to create time entry by hours:', await response1.text());
    }

    // Test 2: Create a cost entry by cost
    const costEntry = {
      projectId: 1,
      personnelId: 1,
      date: new Date().toISOString(),
      totalCost: 400,
      description: "Test cost entry by cost",
      entryType: "cost"
    };

    const response2 = await fetch('http://localhost:5000/api/time-entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(costEntry)
    });

    if (response2.ok) {
      const result2 = await response2.json();
      console.log('✓ Cost entry by cost created:', result2);
    } else {
      console.error('✗ Failed to create cost entry by cost:', await response2.text());
    }

    // Test 3: Fetch time entries to verify bidirectional calculations
    const response3 = await fetch('http://localhost:5000/api/time-entries/project/1');
    if (response3.ok) {
      const entries = await response3.json();
      console.log('✓ Fetched entries for project 1:', entries.length, 'entries');
      entries.forEach((entry, index) => {
        console.log(`Entry ${index + 1}:`, {
          entryType: entry.entryType,
          hours: entry.hours,
          totalCost: entry.totalCost,
          hourlyRateAtTime: entry.hourlyRateAtTime
        });
      });
    } else {
      console.error('✗ Failed to fetch time entries:', await response3.text());
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Run the test
testCostTimeTracking();