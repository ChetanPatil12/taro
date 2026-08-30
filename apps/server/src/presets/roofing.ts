import type { JobDefinition } from '@taro/shared';

/**
 * Demo preset: a residential roofing job with four parties and eight steps.
 * This is ONE instantiation of the engine — nothing outside this file knows
 * anything about roofing. The registry seed pre-books the subcontractor on
 * another job so the cross-job resource conflict fires during kickoff.
 */
export const ROOFING_PRESET: JobDefinition = {
  title: 'Roofing Inspection & Repair Coordination',
  description:
    "Here's the situation: Sarah Chen owns a house with an asphalt shingle roof, " +
    'roughly 24 years old. She reported missing shingles on the west face and a leak ' +
    'near the chimney on the north side — the leak is getting worse, so speed matters. ' +
    'We need to get an on-site inspection scheduled within the next 5 days, then agree ' +
    'the scope of repairs and produce a written quote. The original budget is $18,500; ' +
    'any scope change above 5% of budget must go back to the homeowner before we commit. ' +
    "Bob's Roofing does the inspection and the repair work — check their availability " +
    'across other jobs before proposing dates. Materials come from BuildCo Supply and ' +
    'must be ordered only after Sarah approves the quote; delivery normally takes 2 ' +
    'business days and the repair itself takes 2 consecutive days. Mike Torres runs the ' +
    'project and signs off on every binding step. Wrap up by confirming the final repair ' +
    'schedule with everyone once materials are locked in.',
  parties: [
    {
      name: 'Sarah Chen',
      role: 'homeowner',
      channel: 'chat',
      instructions:
        'Sarah is the homeowner. She must approve all quotes before work proceeds. ' +
        'Available Mon–Sat 9am–6pm. Fairly responsive but asks lots of questions. ' +
        'She reported missing shingles on the west face and a leak near the chimney.',
    },
    {
      name: 'Mike Torres',
      role: 'project_manager',
      channel: 'chat',
      isCoordinator: true,
      instructions:
        'Mike is the project manager for the roofing company. He coordinates all parties ' +
        'and approves the final scope before it goes to the homeowner. He needs at least ' +
        '24h notice for scheduling changes.',
    },
    {
      name: "Bob's Roofing",
      role: 'subcontractor',
      channel: 'chat',
      instructions:
        "Bob's Roofing is the subcontractor team. They do the inspection and the repair " +
        'work. They need 2 consecutive days for a full repair job and are available ' +
        'Monday–Friday. Always check their cross-job availability before proposing dates.',
    },
    {
      name: 'BuildCo Supply',
      role: 'supplier',
      channel: 'chat',
      instructions:
        'BuildCo Supply provides all roofing materials. Standard delivery lead time is ' +
        '2 business days after a confirmed materials list. They can usually match scope ' +
        'additions within 1 business day if notified early.',
    },
  ],
};

/** Pre-existing commitment that triggers the cross-job conflict scenario. */
export const ROOFING_REGISTRY_SEED = {
  partyName: "Bob's Roofing",
  partyType: 'subcontractor',
  jobId: 'preset-conflict-job-001',
  jobTitle: 'Johnson Gutters Replacement',
  // Relative to "now" so the demo works on any day: booked tomorrow + day after.
  startOffsetDays: 1,
  durationDays: 2,
};
