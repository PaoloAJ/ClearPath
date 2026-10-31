import { fireEvent, render, screen } from '@testing-library/react-native';

import { ElevatorRow } from '@/components/ElevatorRow';
import { RouteCard } from '@/components/RouteCard';
import type { Elevator, RouteOption } from '@/lib/types';

const now = new Date('2026-10-30T12:00:00Z');

const forYou: RouteOption = {
  id: 'r1', label: 'For you', fits_profile: true, distance_m: 640, duration_s: 660,
  geometry: { type: 'LineString', coordinates: [] }, edge_ids: [1], notes: ['Uses the Marston east elevator (working)'],
};
const fastest: RouteOption = { ...forYou, id: 'r2', label: 'Fastest', fits_profile: false, duration_s: 480, notes: ['Stairs at Turlington'] };

it('names the planner\'s pick for the profile and tags it For you (R3)', async () => {
  const onSelect = jest.fn();
  await render(<RouteCard route={forYou} mode="wheelchair" selected onSelect={onSelect} />);
  expect(screen.getByText('Step-free')).toBeTruthy();
  expect(screen.getByText('FOR YOU')).toBeTruthy();
  expect(screen.getByText('11 min')).toBeTruthy();
  expect(screen.getByRole('radio', { checked: true })).toBeTruthy();
});

it('keeps routes that break the profile visible, with the reason (R3)', async () => {
  const onSelect = jest.fn();
  await render(<RouteCard route={fastest} mode="wheelchair" selected={false} onSelect={onSelect} />);
  expect(screen.getByText('Breaks your profile: Stairs at Turlington.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: /^Fastest\./ }));
  expect(onSelect).toHaveBeenCalledWith(fastest);
});

const elevator: Elevator = {
  id: 1, building: 'Marston Science Library', name: 'East elevator', node_id: 1, status: 'working', verified: true,
  last_reported_at: '2026-10-30T11:40:00Z',
};

it('writes elevator status out and says who reported it (R1, R5, R6)', async () => {
  await render(<ElevatorRow elevator={elevator} now={now} />);
  expect(screen.getByText('Working')).toBeTruthy();
  expect(screen.getByText('Verified · UF Facilities · 20 min ago')).toBeTruthy();
});

it('links an out-of-service elevator to its alert', async () => {
  const onSeeAlert = jest.fn();
  await render(<ElevatorRow elevator={{ ...elevator, status: 'out', verified: false }} now={now} onSeeAlert={onSeeAlert} />);
  expect(screen.getByText('Out of service')).toBeTruthy();
  expect(screen.getByText('Student report · 20 min ago')).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', { name: /See the alert/ }));
  expect(onSeeAlert).toHaveBeenCalled();
});

it('shows an elevator nobody has reported on as unconfirmed', async () => {
  await render(<ElevatorRow elevator={{ ...elevator, status: 'unconfirmed', verified: false, last_reported_at: null }} now={now} />);
  expect(screen.getByText('Unconfirmed')).toBeTruthy();
  expect(screen.getByText('No recent reports')).toBeTruthy();
});
