import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Reviews = () => {
    const [reviews, setReviews] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const fetchReviews = async () => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            navigate('/login'); // Redirect to login if no token is found
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/reviews?token=${token}`);
            const data = await response.json();
            if (response.ok) {
                setReviews(data.reviews || []);
            } else {
                console.error('Error fetching reviews:', data.error);
                setError('Error fetching reviews. Please try again later.');
            }
        } catch (error) {
            console.error('Failed to fetch reviews:', error);
            setError('Failed to fetch reviews. Please try again.');
        }
    };

    useEffect(() => {
        fetchReviews();
    }, []);

    return (
        <div>
            <h1>Google Reviews</h1>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {reviews.length > 0 ? (
                <ul>
                    {reviews.map((review, index) => (
                        <li key={index}>
                            <strong>{review.reviewer}</strong>: {review.comment}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No reviews found.</p>
            )}
        </div>
    );
};

export default Reviews;
