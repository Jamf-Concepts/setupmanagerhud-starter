import { AgGridReact } from 'ag-grid-react';
import { jamfAgGridThemeV35 } from '@jamf/design-system-web-components-next/table';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { setVisibility } from '../api.js';
import type { EventRow } from '../api.js';

interface Props {
  events: EventRow[];
  showHidden?: boolean;
  onVisibilityChange?: () => void;
}

function VisibilityCell({ data, onVisibilityChange }: ICellRendererParams & { onVisibilityChange?: () => void }) {
  const row = data as EventRow;
  return (
    <button
      style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}
      onClick={async () => {
        await setVisibility(row.eventId, !row.isArchived);
        onVisibilityChange?.();
      }}
    >
      {row.isArchived ? 'Enable' : 'Disable'}
    </button>
  );
}

export default function EventsTable({ events, showHidden = false, onVisibilityChange }: Props) {
  const colDefs: ColDef<EventRow>[] = [
    { field: 'timestamp', headerName: 'Time', width: 160, valueFormatter: p => p.value ? new Date(p.value as string).toLocaleString() : '' },
    { field: 'serialNumber', headerName: 'Serial', width: 140 },
    { field: 'modelName', headerName: 'Model', width: 160 },
    { field: 'macosVersion', headerName: 'macOS', width: 100 },
    { field: 'eventType', headerName: 'Type', width: 120 },
    { field: 'hasFailedActions', headerName: 'Failed', width: 80, cellRenderer: (p: ICellRendererParams) => p.value ? '✗' : '✓' },
    { field: 'failedActionCount', headerName: 'Fail#', width: 70 },
    { field: 'totalActionCount', headerName: 'Total#', width: 70 },
    { field: 'durationSeconds', headerName: 'Duration(s)', width: 110 },
    {
      headerName: 'Visibility',
      width: 90,
      cellRenderer: (p: ICellRendererParams) => <VisibilityCell {...p} onVisibilityChange={onVisibilityChange} />,
    },
  ];

  const rows = showHidden ? events.filter(e => e.isArchived) : events.filter(e => !e.isArchived);

  return (
    <div style={{ height: 400, width: '100%' }}>
      <AgGridReact<EventRow>
        theme={jamfAgGridThemeV35}
        rowData={rows}
        columnDefs={colDefs}
        defaultColDef={{ sortable: true, resizable: true, filter: true }}
      />
    </div>
  );
}
