import { useState } from 'react';
import CartSummary from '../components/CartSummary';
import ContainerFilter from '../components/ContainerFilter';
import Header from '../components/Header';
import RootbeerList from '../components/RootbeerList';

function CatalogPage() {
  const [selectedContainers, setSelectedContainers] = useState<string[]>([]);

  return (
    <div className="Container mt-4">
      <CartSummary />
      <Header />
      <div className="row">
        <div className="col-md-3">
          <ContainerFilter
            selectedContainers={selectedContainers}
            setSelectedContainers={setSelectedContainers}
          />
        </div>
        <div className="col-md-9">
          <RootbeerList selectedContainers={selectedContainers} />
        </div>
      </div>
    </div>
  );
}

export default CatalogPage;
