import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CartSummary from '../components/CartSummary';
import Header from '../components/Header';
import { useCart } from '../context/CartContext';
import { CartItem } from '../types/CartItem';

function ProductPage() {
  const navigate = useNavigate();
  const { rootbeerName, rootbeerId, currentRetailPrice } = useParams();
  const price = currentRetailPrice ? parseFloat(currentRetailPrice) : 0;

  if (!rootbeerName || !rootbeerId) {
    throw new Error(
      'Missing required route parameters: rootbeerName or rootbeerId'
    );
  }

  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState<number>(1);

  const handleAddToCart = () => {
    const newItem: CartItem = {
      rootbeerId,
      rootbeerName,
      price,
      quantity,
    };

    addToCart(newItem);
    navigate('/cart');
  };

  return (
    <>
      <CartSummary />
      <Header />
      <h1>Want a cold refreshing {rootbeerName}?</h1>
      <h2>Only ${price.toFixed(2)}</h2>
      <div>
        <select
          name="quantity"
          className="form-select form-select-lg mb-3"
          onChange={(event) => setQuantity(Number(event.target.value))}
        >
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
        <button onClick={handleAddToCart}>Add to Cart</button>
      </div>

      <button onClick={() => navigate('/catalog')}>Go Back</button>
    </>
  );
}

export default ProductPage;
