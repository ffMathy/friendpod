import { LEGAL_TEXT_SHA256 } from '@grouper/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Art9ConsentSheet } from '@/features/consent/Art9ConsentSheet';
import { appVersion } from '@/lib/appVersion';

const handlers = () => ({ onAdd: jest.fn(), onDontAdd: jest.fn(), onReadMore: jest.fn() });

describe('Art. 9 consent sheet (PRIVACY.md §3.3)', () => {
  it('shows the versioned copy with the user’s own wording', async () => {
    await render(<Art9ConsentSheet tag="On paternity leave" locale="en" {...handlers()} />);
    expect(screen.getByText('This interest may be sensitive')).toBeOnTheScreen();
    expect(screen.getByText(/^"On paternity leave" may reveal information about your health/)).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: /I explicitly consent to Grouper processing "On paternity leave"/ })).toBeOnTheScreen();
  });

  it('starts unticked, with "Add" disabled until the box is ticked', async () => {
    const h = handlers();
    await render(<Art9ConsentSheet tag="gravid" locale="en" {...h} />);
    const checkbox = screen.getByTestId('consent-checkbox');
    const add = screen.getByTestId('consent-add');
    expect(checkbox).not.toBeChecked();
    expect(add).toBeDisabled();

    await fireEvent.press(add);
    expect(h.onAdd).not.toHaveBeenCalled();

    await fireEvent.press(checkbox);
    expect(checkbox).toBeChecked();
    expect(add).toBeEnabled();

    await fireEvent.press(checkbox);
    expect(add).toBeDisabled();
  });

  it('sends {textVersion, textSha256, appVersion, checked: true} for the text that was shown', async () => {
    const h = handlers();
    await render(<Art9ConsentSheet tag="gravid" locale="en" {...h} />);
    await fireEvent.press(screen.getByTestId('consent-checkbox'));
    await fireEvent.press(screen.getByTestId('consent-add'));
    expect(h.onAdd).toHaveBeenCalledTimes(1);
    expect(h.onAdd).toHaveBeenCalledWith({
      consent: { textVersion: 'art9-tag-en-v1', textSha256: LEGAL_TEXT_SHA256['art9-tag-en-v1'], appVersion, checked: true },
    });
  });

  it('uses the Danish text and its own hash in Danish', async () => {
    const h = handlers();
    await render(<Art9ConsentSheet tag="gravid" locale="da" {...h} />);
    expect(screen.getByText('Denne interesse kan være følsom')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('consent-checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Tilføj interesse' }));
    expect(h.onAdd).toHaveBeenCalledWith({
      consent: { textVersion: 'art9-tag-da-v1', textSha256: LEGAL_TEXT_SHA256['art9-tag-da-v1'], appVersion, checked: true },
    });
  });

  it('includes the optional category only when the user picks one', async () => {
    const h = handlers();
    await render(<Art9ConsentSheet tag="gravid" locale="en" {...h} />);
    await fireEvent.press(screen.getByTestId('category-health'));
    await fireEvent.press(screen.getByTestId('consent-checkbox'));
    await fireEvent.press(screen.getByTestId('consent-add'));
    expect(h.onAdd).toHaveBeenCalledWith(expect.objectContaining({ category: 'health' }));
  });

  it('"Don\'t add" discards without consent, ticked or not', async () => {
    const h = handlers();
    await render(<Art9ConsentSheet tag="gravid" locale="en" {...h} />);
    await fireEvent.press(screen.getByRole('button', { name: "Don't add" }));
    expect(h.onDontAdd).toHaveBeenCalledTimes(1);
    expect(h.onAdd).not.toHaveBeenCalled();
  });
});
