const express = require('express');
const app = express();

// Simple endpoint para testing
app.get("/api/projects/:id/deviation-analysis", (req, res) => {
  console.log(`🎯 SIMPLE TEST SERVER - ID: ${req.params.id}`);
  res.json({
    deviationByRole: [],
    totalVariance: { variance: 0 },
    summary: { membersOverBudget: 0, membersUnderBudget: 0 },
    majorDeviations: [],
    analysis: [],
    message: 'Simple test server working',
    debug: {
      projectId: req.params.id,
      query: req.query
    }
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
});