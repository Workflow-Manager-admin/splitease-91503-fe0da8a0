import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('renders FairSplit dashboard', () => {
  render(<App />);
  expect(screen.getByText(/Welcome to FairSplit/i)).toBeInTheDocument();
  expect(screen.getByRole("navigation")).toBeInTheDocument();
});

test('dashboard has Add Person button if no people', () => {
  render(<App />);
  const addBtn = screen.getByText(/add person/i);
  expect(addBtn).toBeInTheDocument();
});
