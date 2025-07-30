import fetch from 'node-fetch';

async function testQuotationSave() {
  const baseUrl = 'http://localhost:5000';
  let sessionId = null;

  try {
    // 1. Login first
    console.log('1. Logging in...');
    const loginResponse = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tomas@epical.digital',
        password: 'epical2025'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    // Extract session cookie
    const cookies = loginResponse.headers.get('set-cookie');
    if (cookies) {
      const sessionMatch = cookies.match(/sessionId=([^;]+)/);
      if (sessionMatch) {
        sessionId = sessionMatch[0];
      }
    }

    console.log('✅ Login successful');

    // 2. Create a test quotation
    console.log('\n2. Creating test quotation...');
    const quotationData = {
      clientId: 34, // MODO
      projectName: "Test Quotation with Team",
      projectType: "on-demand",
      projectDuration: "3 months",
      analysisType: "standard",
      mentionsVolume: "medium",
      countriesCovered: "1",
      clientEngagement: "medium",
      baseCost: 5000,
      complexityAdjustment: 500,
      markupAmount: 2750,
      totalAmount: 8250,
      discountPercentage: 0,
      platformCost: 0,
      toolsCost: 0,
      priceMode: "auto",
      quotationCurrency: "USD"
    };

    const createResponse = await fetch(`${baseUrl}/api/quotations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionId
      },
      body: JSON.stringify(quotationData)
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Create quotation failed: ${createResponse.status} - ${error}`);
    }

    const quotation = await createResponse.json();
    console.log('✅ Quotation created with ID:', quotation.id);

    // 3. Add team members
    console.log('\n3. Adding team members...');
    const teamMembers = [
      {
        quotationId: quotation.id,
        roleId: 15, // Analista Junior
        personnelId: null, // No assigned personnel
        hours: 100,
        rate: 8,
        cost: 800
      },
      {
        quotationId: quotation.id,
        roleId: 21, // Tech Lead
        personnelId: null, // No assigned personnel
        hours: 50,
        rate: 9.2,
        cost: 460
      }
    ];

    for (const member of teamMembers) {
      console.log(`\nAdding team member - Role ID: ${member.roleId}`);
      
      const memberResponse = await fetch(`${baseUrl}/api/quotation-team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionId
        },
        body: JSON.stringify(member)
      });

      if (!memberResponse.ok) {
        const error = await memberResponse.text();
        console.error(`❌ Failed to add team member: ${memberResponse.status} - ${error}`);
      } else {
        const savedMember = await memberResponse.json();
        console.log('✅ Team member added:', savedMember);
      }
    }

    // 4. Verify team members were saved
    console.log('\n4. Verifying team members...');
    const verifyResponse = await fetch(`${baseUrl}/api/quotation-team/${quotation.id}`, {
      headers: {
        'Cookie': sessionId
      }
    });

    if (!verifyResponse.ok) {
      throw new Error(`Failed to verify team members: ${verifyResponse.status}`);
    }

    const savedMembers = await verifyResponse.json();
    console.log(`\n✅ Found ${savedMembers.length} team members saved:`);
    savedMembers.forEach(member => {
      console.log(`- Role ID: ${member.roleId}, Personnel ID: ${member.personnelId}, Hours: ${member.hours}, Cost: $${member.cost}`);
    });

    // 5. Delete the test quotation
    console.log('\n5. Cleaning up test quotation...');
    const deleteResponse = await fetch(`${baseUrl}/api/quotations/${quotation.id}`, {
      method: 'DELETE',
      headers: {
        'Cookie': sessionId
      }
    });

    if (deleteResponse.ok) {
      console.log('✅ Test quotation deleted');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testQuotationSave();