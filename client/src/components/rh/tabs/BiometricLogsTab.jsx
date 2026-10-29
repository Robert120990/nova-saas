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
    onApplyRange,
    punchType,
    onPunchTypeChange,
    source,
    onSourceChange
}) => {
    return (
        <div className="space-y-6">
            <BiometricSummaryCards summary={summary} />

            <BiometricFiltersBar
                searchTerm={searchTerm}
                onSearchChange={onSearchChange}
                startDate={startDate}
                onStartDateChange={onStartDateChange}
                endDate={endDate}
                onEndDateChange={onEndDateChange}
                onApplyRange={onApplyRange}
                punchType={punchType}
                onPunchTypeChange={onPunchTypeChange}
                source={source}
                onSourceChange={onSourceChange}
            />

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
