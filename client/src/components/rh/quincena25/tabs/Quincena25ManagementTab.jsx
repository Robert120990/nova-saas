import Quincena25FiltersBar from '../Quincena25FiltersBar';
import Quincena25SummaryCards from '../Quincena25SummaryCards';
import Quincena25ActionBar from '../Quincena25ActionBar';
import Quincena25ItemsTable from '../Quincena25ItemsTable';

const Quincena25ManagementTab = ({ model }) => (
    <fieldset disabled={model.contextBusy} className="min-w-0 space-y-6">
        <Quincena25FiltersBar model={model} />
        <Quincena25SummaryCards model={model} />
        <Quincena25ActionBar model={model} />
        <Quincena25ItemsTable model={model} />
    </fieldset>
);

export default Quincena25ManagementTab;
