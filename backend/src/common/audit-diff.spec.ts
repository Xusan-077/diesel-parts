import { diffFields } from './audit-diff';

describe('diffFields', () => {
  it('returns null when nothing moved', () => {
    // A seller pressing save on an unchanged form is not an event worth a
    // line in the trail.
    expect(
      diffFields(
        { status: 'NEW', notes: null },
        { status: 'NEW', notes: null },
      ),
    ).toBeNull();
  });

  it('carries only the fields that changed', () => {
    const diff = diffFields(
      { status: 'NEW', notes: 'call back', followUpAt: null },
      { status: 'WON', notes: 'call back', followUpAt: null },
    );

    expect(diff).toEqual({
      before: { status: 'NEW' },
      after: { status: 'WON' },
    });
  });

  it('reports several changes together', () => {
    const diff = diffFields(
      { status: 'NEW', notes: null },
      { status: 'IN_PROGRESS', notes: 'quoted' },
    );

    expect(diff).toEqual({
      before: { status: 'NEW', notes: null },
      after: { status: 'IN_PROGRESS', notes: 'quoted' },
    });
  });

  it('sees a value being cleared', () => {
    expect(diffFields({ notes: 'old' }, { notes: null })).toEqual({
      before: { notes: 'old' },
      after: { notes: null },
    });
  });

  it('compares dates by their instant, not by identity', () => {
    const when = '2026-09-01T00:00:00.000Z';
    expect(
      diffFields(
        { followUpAt: new Date(when) },
        { followUpAt: new Date(when) },
      ),
    ).toBeNull();
  });

  it('reports a date that actually moved', () => {
    const diff = diffFields(
      { followUpAt: new Date('2026-09-01T00:00:00.000Z') },
      { followUpAt: new Date('2026-09-08T00:00:00.000Z') },
    );

    expect(diff).not.toBeNull();
    expect(diff?.after.followUpAt).toEqual(
      new Date('2026-09-08T00:00:00.000Z'),
    );
  });

  it('does not treat a number and its string form as equal', () => {
    expect(diffFields({ percent: 5 }, { percent: '5' })).not.toBeNull();
  });
});
