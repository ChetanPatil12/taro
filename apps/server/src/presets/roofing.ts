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
    'Full coordination of a residential roofing job — from initial homeowner contact ' +
    'through inspection, scope review, materials order, and work scheduling. ' +
    'Homeowner reported: missing shingles on west face, leak near chimney on north side. ' +
    'Roof is asphalt shingle, approximately 24 years old. Original quote budget: $18,500. ' +
    'Target: inspection within the next 5 days.',
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
  steps: [
    {
      title: 'Initial contact with homeowner',
      description:
        "Introduce the coordination service, confirm Sarah's contact details, and get her " +
        'availability windows for the inspection.',
      requiredParties: ['Sarah Chen'],
      dependsOn: [],
      conditions: 'Job start',
    },
    {
      title: 'Coordinate inspection date with PM and subcontractor',
      description:
        "Find a date that works for Mike and Bob's Roofing for the on-site inspection. " +
        "Check Bob's Roofing availability across all active jobs first.",
      requiredParties: ['Mike Torres', "Bob's Roofing"],
      dependsOn: ['Initial contact with homeowner'],
      conditions: 'After homeowner availability confirmed',
    },
    {
      title: 'Confirm inspection date with homeowner',
      description:
        'Inform Sarah of the proposed inspection date and get explicit confirmation. ' +
        'Confirming the date is a binding commitment (approval gate).',
      requiredParties: ['Sarah Chen'],
      dependsOn: ['Coordinate inspection date with PM and subcontractor'],
      conditions: 'After PM and subcontractor agree on a date',
    },
    {
      title: 'On-site inspection',
      description:
        "Bob's Roofing performs the inspection using a checklist derived from Sarah's " +
        'reported issues, and reports findings.',
      requiredParties: ["Bob's Roofing"],
      dependsOn: ['Confirm inspection date with homeowner'],
      conditions: 'On the confirmed date',
    },
    {
      title: 'Post-inspection scope and quote',
      description:
        'Coordinate with Mike and Bob to define the full scope of work and produce a ' +
        'quote document. If additional damage is found, reconcile the scope change ' +
        '(compute revised totals in the sandbox; owner approval required above 5% change).',
      requiredParties: ['Mike Torres', "Bob's Roofing"],
      dependsOn: ['On-site inspection'],
      conditions: 'After inspection findings reported',
    },
    {
      title: 'Homeowner quote approval',
      description:
        'Present the quote to Sarah. Accepting the quote is a binding commitment ' +
        '(approval gate).',
      requiredParties: ['Sarah Chen'],
      dependsOn: ['Post-inspection scope and quote'],
      conditions: 'After PM confirms the scope',
    },
    {
      title: 'Place materials order with supplier',
      description:
        'Send the confirmed materials list to BuildCo Supply and get a delivery date. ' +
        'Placing the order is a binding commitment (approval gate).',
      requiredParties: ['BuildCo Supply'],
      dependsOn: ['Homeowner quote approval'],
      conditions: 'After homeowner approves the quote',
    },
    {
      title: 'Schedule repair work and confirm with all parties',
      description:
        'Coordinate the final repair schedule with Mike, Bob, and Sarah; verify the ' +
        'materials delivery date aligns; regenerate the schedule artifact; send final ' +
        'confirmations to every party.',
      requiredParties: ['Mike Torres', "Bob's Roofing", 'Sarah Chen'],
      dependsOn: ['Place materials order with supplier'],
      conditions: 'After materials delivery date confirmed',
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
