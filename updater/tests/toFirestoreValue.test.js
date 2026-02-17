import { describe, it, expect } from 'vitest';
import { _toFirestoreValue as toFirestoreValue } from '../src/firebase-push.js';

describe('toFirestoreValue', () => {
  // Company double fields produce { doubleValue } even for round integers
  it('company double fields produce doubleValue even for integers', () => {
    expect(toFirestoreValue('totalDemocrat', 1000)).toEqual({ doubleValue: 1000 });
    expect(toFirestoreValue('totalRepublican', 0)).toEqual({ doubleValue: 0 });
    expect(toFirestoreValue('percentDemocrat', 55)).toEqual({ doubleValue: 55 });
    expect(toFirestoreValue('percentRepublican', 45.5)).toEqual({ doubleValue: 45.5 });
    expect(toFirestoreValue('totalOther', 100)).toEqual({ doubleValue: 100 });
    expect(toFirestoreValue('totalContributions', 5000)).toEqual({ doubleValue: 5000 });
  });

  // Candidate double fields produce { doubleValue }
  it('candidate double fields produce doubleValue', () => {
    expect(toFirestoreValue('totalRaised', 50000)).toEqual({ doubleValue: 50000 });
    expect(toFirestoreValue('totalFromPacs', 0)).toEqual({ doubleValue: 0 });
    expect(toFirestoreValue('totalFromIndividuals', 25000)).toEqual({ doubleValue: 25000 });
    expect(toFirestoreValue('totalAmount', 1500)).toEqual({ doubleValue: 1500 });
  });

  // Integer fields produce { integerValue }
  it('rank and disbursementCount produce integerValue', () => {
    expect(toFirestoreValue('rank', 42)).toEqual({ integerValue: '42' });
    expect(toFirestoreValue('disbursementCount', 100)).toEqual({ integerValue: '100' });
    expect(toFirestoreValue('donorCount', 5)).toEqual({ integerValue: '5' });
    expect(toFirestoreValue('contributionCount', 3)).toEqual({ integerValue: '3' });
  });

  // Nested objects (like Donor in topDonors) get correct types
  it('nested donor objects get correct types via mapValue', () => {
    const donor = {
      name: 'ACME PAC',
      type: 'pac',
      totalAmount: 5000,
      contributionCount: 3,
      employer: 'ACME Corp',
      state: 'NC'
    };
    const result = toFirestoreValue(null, donor);
    expect(result.mapValue.fields.name).toEqual({ stringValue: 'ACME PAC' });
    expect(result.mapValue.fields.type).toEqual({ stringValue: 'pac' });
    expect(result.mapValue.fields.totalAmount).toEqual({ doubleValue: 5000 });
    expect(result.mapValue.fields.contributionCount).toEqual({ integerValue: '3' });
    expect(result.mapValue.fields.employer).toEqual({ stringValue: 'ACME Corp' });
    expect(result.mapValue.fields.state).toEqual({ stringValue: 'NC' });
  });

  // String values
  it('strings produce stringValue', () => {
    expect(toFirestoreValue('name', 'Walmart')).toEqual({ stringValue: 'Walmart' });
    expect(toFirestoreValue('category', 'support')).toEqual({ stringValue: 'support' });
  });

  // Boolean values
  it('booleans produce booleanValue', () => {
    expect(toFirestoreValue('hasPac', true)).toEqual({ booleanValue: true });
    expect(toFirestoreValue('hasPac', false)).toEqual({ booleanValue: false });
  });

  // Null/undefined
  it('null and undefined produce nullValue', () => {
    expect(toFirestoreValue('field', null)).toEqual({ nullValue: null });
    expect(toFirestoreValue('field', undefined)).toEqual({ nullValue: null });
  });

  // Arrays
  it('arrays produce arrayValue', () => {
    const result = toFirestoreValue('fecCommitteeIds', ['C001', 'C002']);
    expect(result).toEqual({
      arrayValue: {
        values: [
          { stringValue: 'C001' },
          { stringValue: 'C002' }
        ]
      }
    });
  });

  // Non-double decimal numbers
  it('non-double-field decimals produce doubleValue', () => {
    expect(toFirestoreValue('someOtherField', 3.14)).toEqual({ doubleValue: 3.14 });
  });
});
