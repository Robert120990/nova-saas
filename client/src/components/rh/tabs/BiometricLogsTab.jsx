import {
    BiometricSummaryCards,
    BiometricFiltersBar,
    BiometricLogsTable
} from '..';

const BiometricLogsTab = ({
    summary,
    logs,
    isLoading,
    pagination,
    limit,
    onLimitChange,
    onPageChange,
    searchTerm,
    onSearchChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    punchType,
    onPunchTypeChange,
    source,
    onSourceChange
}) => {
    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <BiometricSummaryCards summary={summary} />

            {/* Filter Bar */}
            <BiometricFiltersBar
                searchTerm={searchTerm}
                onSearchChange={onSearchChange}
                startDate={startDate}
                onStartDateChange={onStartDateChange}
                endDate={endDate}
                onEndDateChange={onEndDateChange}
                punchType={punchType}
                onPunchTypeChange={onPunchTypeChange}
                source={source}
                onSourceChange={onSourceChange}
            />

            {/* Attendance Logs Table */}
            <BiometricLogsTable
                logs={logs}
                isLoading={isLoading}
                pagination={pagination}
                limit={limit}
                onLimitChange={onLimitChange}
                onPageChange={onPageChange}
            />
        </div>
    );
};

export default BiometricLogsTab;
