import { EssentialLevel } from '@finnit/database';

import {
  essentialsRequest,
  parseEssentials,
  storedAnswers,
  validAnswers,
} from './recurring-essentials';

const all = [
  { question: 'household', answer: 'alone' },
  { question: 'dependents', answer: 'none' },
  { question: 'work', answer: 'remote' },
  { question: 'transport', answer: 'public' },
  { question: 'health', answer: 'none' },
  { question: 'entertainment', answer: 'rarely' },
  { question: 'goal', answer: 'save' },
  { question: 'cut', answer: 'moderate' },
];

describe('recurring essentials', () => {
  it('takes every question answered with one of its options', () => {
    expect(validAnswers(all)).toMatchObject({
      work: 'remote',
      cut: 'moderate',
    });
    expect(validAnswers(all.slice(1))).toBeNull();
    expect(
      validAnswers([...all, { question: 'work', answer: 'astronaut' }]),
    ).toBeNull();
    expect(
      validAnswers([...all, { question: 'zodiac', answer: 'leo' }]),
    ).toBeNull();
    expect(storedAnswers({ work: 'remote', zodiac: 'leo', cut: 9 })).toEqual({
      work: 'remote',
    });
  });

  it('sends the answers and the expenses, and keeps only valid levels', () => {
    const text = essentialsRequest(
      { work: 'remote' },
      [
        {
          id: 'e1',
          name: 'Netflix',
          kind: 'subscription',
          category: 'Streaming',
          monthlyCost: 299,
          currency: 'MXN',
        },
      ],
      'es',
    );
    expect(JSON.parse(text)).toEqual({
      locale: 'es',
      answers: { work: 'remote' },
      expenses: [
        {
          id: 'e1',
          name: 'Netflix',
          kind: 'subscription',
          category: 'Streaming',
          monthlyCost: '299.00 MXN',
        },
      ],
    });
    const parsed = parseEssentials(
      {
        items: [
          { id: 'e1', level: 'dispensable', reason: ' Casi no lo usas. ' },
          { id: 'e2', level: 'essential', reason: 'x' },
          { id: 'e1x', level: 'whatever', reason: 'x' },
        ],
      },
      new Set(['e1', 'e1x']),
    );
    expect([...parsed]).toEqual([
      ['e1', { level: EssentialLevel.dispensable, reason: 'Casi no lo usas.' }],
    ]);
    expect(parseEssentials(null, new Set(['e1'])).size).toBe(0);
  });
});
