/**
 * Demo data so the app, Prometheus and Grafana have something to show on first boot.
 *  - Runs automatically on API start when the database is empty (SEED_ON_START=true)
 *  - Or manually:  npm run seed            (only if empty)
 *                  npm run seed -- --reset (wipe + reseed)
 */
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Resource from '../models/Resource.js';
import ResourceRequest from '../models/ResourceRequest.js';
import Allocation from '../models/Allocation.js';
import Booking from '../models/Booking.js';
import Maintenance from '../models/Maintenance.js';
import Notification from '../models/Notification.js';
import ActivityLog from '../models/ActivityLog.js';
import logger from '../utils/logger.js';

export const DEMO_PASSWORD = { admin: 'Admin@123', employee: 'Employee@123' };

const people = [
  { name: 'Aditi Sharma', email: 'admin@resourcehub.com', role: 'ADMIN', department: 'IT Operations' },
  { name: 'Rohan Mehta', email: 'employee@resourcehub.com', role: 'EMPLOYEE', department: 'Engineering' },
  { name: 'Priya Nair', email: 'priya@resourcehub.com', role: 'EMPLOYEE', department: 'Design' },
  { name: 'Karan Verma', email: 'karan@resourcehub.com', role: 'EMPLOYEE', department: 'Sales' },
  { name: 'Sneha Kulkarni', email: 'sneha@resourcehub.com', role: 'EMPLOYEE', department: 'HR' },
  { name: 'Vikram Rao', email: 'vikram@resourcehub.com', role: 'EMPLOYEE', department: 'Engineering' },
  { name: 'Ananya Iyer', email: 'ananya@resourcehub.com', role: 'EMPLOYEE', department: 'Finance' }
];

const catalogue = [
  ['LAP-001', 'Dell Latitude 7440', 'Laptop', 'IT Store, Floor 2'],
  ['LAP-002', 'Dell Latitude 7440', 'Laptop', 'IT Store, Floor 2'],
  ['LAP-003', 'MacBook Pro 14" M3', 'Laptop', 'IT Store, Floor 2'],
  ['LAP-004', 'Lenovo ThinkPad T14', 'Laptop', 'IT Store, Floor 2'],
  ['LAP-005', 'HP EliteBook 840', 'Laptop', 'IT Store, Floor 2'],
  ['LAP-006', 'MacBook Air 13" M2', 'Laptop', 'IT Store, Floor 2'],
  ['MON-001', 'LG UltraFine 27" 4K', 'Monitor', 'Desk Bay A'],
  ['MON-002', 'LG UltraFine 27" 4K', 'Monitor', 'Desk Bay A'],
  ['MON-003', 'Dell UltraSharp 24"', 'Monitor', 'Desk Bay B'],
  ['MON-004', 'Samsung Odyssey 32"', 'Monitor', 'Desk Bay B'],
  ['PRN-001', 'HP LaserJet Pro M404', 'Printer', 'Floor 1 Print Area'],
  ['PRN-002', 'Canon imageRUNNER 2630', 'Printer', 'Floor 3 Print Area'],
  ['PHN-001', 'iPhone 13 (test device)', 'Phone', 'QA Lab'],
  ['PHN-002', 'Pixel 7 (test device)', 'Phone', 'QA Lab'],
  ['CHR-001', 'Ergonomic chair - Herman Miller', 'Furniture', 'Facilities'],
  ['ROOM-101', 'Everest Conference Room', 'Meeting Room', 'Floor 1', 12],
  ['ROOM-102', 'Nilgiri Huddle Room', 'Meeting Room', 'Floor 1', 4],
  ['ROOM-201', 'Himalaya Boardroom', 'Meeting Room', 'Floor 2', 20],
  ['ROOM-301', 'Sahyadri Training Hall', 'Meeting Room', 'Floor 3', 40],
  ['PRJ-001', 'Epson 4K Laser Projector', 'Projector', 'AV Cabinet, Floor 1'],
  ['PRJ-002', 'BenQ Portable Projector', 'Projector', 'AV Cabinet, Floor 2']
];

const at = (dayOffset, hour, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

export const seed = async () => {
  const users = [];
  for (const p of people) {
    users.push(await User.create({ ...p, password: p.role === 'ADMIN' ? DEMO_PASSWORD.admin : DEMO_PASSWORD.employee }));
  }
  const [admin, rohan, priya, karan, sneha, vikram, ananya] = users;

  const resources = {};
  for (const [assetTag, name, category, location, capacity] of catalogue) {
    const isShared = category === 'Meeting Room' || category === 'Projector';
    resources[assetTag] = await Resource.create({
      assetTag,
      name,
      category,
      location,
      isShared,
      capacity: capacity || 0,
      description: isShared ? 'Shared resource - book by time slot' : 'Company asset - request for allocation',
      createdBy: admin._id
    });
  }

  // Allocations (approved requests)
  const allocate = async (tag, employee, daysAgo, note) => {
    const req = await ResourceRequest.create({
      employee: employee._id,
      resource: resources[tag]._id,
      reason: note,
      status: 'APPROVED',
      reviewedBy: admin._id,
      reviewedAt: at(-daysAgo, 11)
    });
    await Allocation.create({
      resource: resources[tag]._id,
      employee: employee._id,
      allocatedBy: admin._id,
      request: req._id,
      dueDate: at(90 - daysAgo, 18)
    });
    resources[tag].status = 'ALLOCATED';
    await resources[tag].save();
  };
  await allocate('LAP-001', rohan, 30, 'New joiner laptop');
  await allocate('MON-001', rohan, 28, 'Dual-monitor setup for development');
  await allocate('LAP-003', priya, 21, 'Design work needs macOS');
  await allocate('LAP-004', karan, 14, 'Field sales laptop');
  await allocate('PHN-001', vikram, 7, 'iOS app testing');

  // Pending requests
  await ResourceRequest.create({ employee: sneha._id, resource: resources['LAP-002']._id, reason: 'Current laptop is very slow for payroll software' });
  await ResourceRequest.create({ employee: ananya._id, resource: resources['MON-003']._id, reason: 'Need a second screen for spreadsheets' });
  await ResourceRequest.create({ employee: vikram._id, resource: resources['PHN-002']._id, reason: 'Android regression testing for release 2.1' });
  await ResourceRequest.create({
    employee: karan._id,
    resource: resources['MON-004']._id,
    reason: 'Bigger screen',
    status: 'REJECTED',
    reviewedBy: admin._id,
    reviewedAt: at(-3, 15),
    reviewNote: 'Reserved for the design team'
  });

  // Maintenance
  for (const [tag, reporter, issue, priority, status] of [
    ['PRN-002', sneha, 'Paper jam error E-03 keeps returning', 'MEDIUM', 'IN_PROGRESS'],
    ['LAP-005', admin, 'Battery swelling - unsafe to use', 'CRITICAL', 'OPEN'],
    ['PRJ-002', priya, 'Lamp flickers after 10 minutes', 'LOW', 'OPEN']
  ]) {
    await Maintenance.create({ resource: resources[tag]._id, reportedBy: reporter._id, issue, priority, status });
    resources[tag].status = 'UNDER_MAINTENANCE';
    await resources[tag].save();
  }
  await Maintenance.create({
    resource: resources['MON-002']._id,
    reportedBy: rohan._id,
    issue: 'Dead pixel cluster in the top-left corner',
    priority: 'LOW',
    status: 'RESOLVED',
    resolutionNote: 'Panel replaced under warranty',
    resolvedAt: at(-5, 16)
  });

  // Bookings: spread over the past and next week so the charts have shape
  const bookingPlan = [
    ['ROOM-101', rohan, 'Sprint planning', -6, 10, 11],
    ['ROOM-201', admin, 'Quarterly business review', -5, 14, 16],
    ['ROOM-102', priya, 'Design critique', -3, 12, 13],
    ['ROOM-301', sneha, 'New-joiner orientation', -2, 9, 12],
    ['ROOM-101', karan, 'Client demo', -1, 15, 16],
    ['ROOM-101', rohan, 'Daily stand-up', 0, 9, 10],
    ['ROOM-102', vikram, 'Bug triage', 0, 11, 12],
    ['ROOM-201', admin, 'Vendor negotiation', 0, 15, 17],
    ['PRJ-001', karan, 'Sales pitch rehearsal', 0, 16, 17],
    ['ROOM-101', priya, 'Sprint review', 1, 10, 11],
    ['ROOM-301', sneha, 'POSH training', 2, 10, 13],
    ['ROOM-102', ananya, 'Budget sync', 2, 14, 15],
    ['ROOM-201', rohan, 'Architecture review', 3, 11, 13],
    ['ROOM-101', vikram, 'Release go/no-go', 4, 17, 18],
    ['PRJ-001', admin, 'Town hall', 5, 16, 18]
  ];
  for (const [tag, who, purpose, day, s, e] of bookingPlan) {
    await Booking.create({ resource: resources[tag]._id, bookedBy: who._id, purpose, startAt: at(day, s), endAt: at(day, e), attendees: 4 });
  }

  // Notifications + activity trail
  await Notification.create([
    { user: admin._id, type: 'REQUEST', message: 'Sneha Kulkarni requested Dell Latitude 7440 (LAP-002)' },
    { user: admin._id, type: 'MAINTENANCE', message: '[CRITICAL] HP EliteBook 840: Battery swelling - unsafe to use' },
    { user: rohan._id, type: 'ALLOCATION', message: 'Dell Latitude 7440 (LAP-001) has been allocated to you' },
    { user: rohan._id, type: 'BOOKING', message: 'Booking confirmed: Everest Conference Room - Daily stand-up' }
  ]);
  await ActivityLog.create([
    { actor: admin._id, action: 'SEED', entity: 'System', description: 'Demo data loaded' },
    { actor: admin._id, action: 'ALLOCATE', entity: 'Allocation', description: 'LAP-001 allocated to Rohan Mehta' },
    { actor: sneha._id, action: 'CREATE_REQUEST', entity: 'ResourceRequest', description: 'Sneha Kulkarni requested LAP-002' },
    { actor: admin._id, action: 'REPORT_ISSUE', entity: 'Maintenance', description: 'Ticket raised for LAP-005 (CRITICAL)' }
  ]);

  return { users: users.length, resources: Object.keys(resources).length, bookings: bookingPlan.length };
};

export const seedIfEmpty = async () => {
  if (await User.estimatedDocumentCount()) return null;
  const summary = await seed();
  logger.info('Demo data seeded', summary);
  return summary;
};

const resetAll = () =>
  Promise.all([User, Resource, ResourceRequest, Allocation, Booking, Maintenance, Notification, ActivityLog].map((m) => m.deleteMany({})));

// CLI entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { connectDB } = await import('../config/db.js');
  await connectDB();
  if (process.argv.includes('--reset')) {
    await resetAll();
    logger.info('Database wiped');
  }
  const result = await seedIfEmpty();
  logger.info(result ? 'Seed complete' : 'Database not empty - nothing seeded (use --reset)');
  await mongoose.disconnect();
}
