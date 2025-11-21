// Centralized feature flags for runtime toggles in development/testing
// Toggle this to force the Emblem celebration animation at run completion
// - true: Always show celebration after saving a run (for filming)
// - false: Normal behavior (show only when emblem conditions are met)
export const EMBLEM_CELEBRATION_TEST_MODE = true;

// Toggle this to test stamp collection popup without backend validation
// - true: Skip API calls, show success modal with mock data
// - false: Normal behavior (call backend API)
export const STAMP_COLLECTION_TEST_MODE = true;

// Toggle this to test pace coach alert popup
// - true: Show pace alert 7 seconds after running starts
// - false: Normal behavior (check every 500m via API)
export const PACE_COACH_TEST_MODE = true;
