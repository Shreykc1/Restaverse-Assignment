import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';

interface Review {
    author_name: string;
    author_url?: string;
    profile_photo_url: string;
    rating: number;
    text: string;
    time: number;
    relative_time_description: string;
    language: string;
    translated: boolean;
}

interface Place {
    place_id: string;
    name: string;
    location_id: string;
    formatted_address: string;
}

const ReviewCard = ({ review, onReply }: {
    review: Review,
    onReply: (reviewId: string, text: string) => Promise<void>
}) => {
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);

    if (!review) {
        return null;
    }

    const handleSubmitReply = async () => {
        try {
            setIsReplying(true);
            await onReply(review.time.toString(), replyText);
            setReplyText('');
            toast.success('Reply submitted successfully!');
        } catch (error) {
            console.error('Reply error:', error);
            toast.error('Failed to submit reply');
        } finally {
            setIsReplying(false);
        }
    };

    return (
        <div className=" border border-gray-300 rounded-2xl p-8 bg-white  hover:shadow-lg transition-all duration-200 space-y-6">
            {/* Review Header */}
            <div className="flex items-start space-x-5">
                <img
                    src={review.profile_photo_url}
                    alt={review.author_name}
                    className="w-12 h-12 rounded-full ring-2 ring-gray-100"
                />
                <div className="flex-1">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="font-medium text-gray-900">
                                {review.author_url ? (
                                    <a href={review.author_url} target="_blank" rel="noopener noreferrer"
                                        className="hover:text-blue-600 transition-colors">
                                        {review.author_name}
                                    </a>
                                ) : (
                                    review.author_name
                                )}
                            </h3>
                            <div className="flex items-center mt-1.5">
                                {[...Array(5)].map((_, i) => (
                                    <span
                                        key={i}
                                        className={`text-base ${i < review.rating ? 'text-yellow-400' : 'text-gray-200'}`}
                                    >
                                        ★
                                    </span>
                                ))}
                                <span className="ml-3 text-sm text-gray-500">
                                    {review.relative_time_description}
                                </span>
                            </div>
                        </div>
                        <span className="text-sm text-gray-400">
                            {new Date(review.time * 1000).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Review Text */}
            <div className="ml-17">
                <p className="text-gray-600 leading-relaxed text-[15px]">{review.text}</p>

                {review.translated && (
                    <p className="text-sm text-gray-400 mt-2">
                        Translated from {review.language}
                    </p>
                )}

                {/* Reply Form */}
                <div className="mt-6 space-y-3">
                    <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your reply..."
                        className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-600 placeholder-gray-400 text-[15px]"
                        rows={3}
                    />
                    <div className="flex justify-end">
                        <button
                            onClick={handleSubmitReply}
                            disabled={isReplying || !replyText.trim()}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium shadow-sm hover:shadow"
                        >
                            {isReplying ? 'Submitting...' : 'Submit Reply'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [places, setPlaces] = useState<Place[]>([]);
    const [selectedPlaceId, setSelectedPlaceId] = useState('');
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const token = searchParams.get('token');
    const idToken = searchParams.get('id_token');

    const handleSearch = async () => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5000/api/search-places?query=${encodeURIComponent(searchQuery)}`);
            const data = await response.json();
            setPlaces(data);
        } catch (error) {
            console.error('Error searching places:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReviews = async (placeId: string) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5000/api/business-reviews/${placeId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            setReviews(data);
        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePlaceSelect = (placeId: string) => {
        setSelectedPlaceId(placeId);
        fetchReviews(placeId);
    };

    const handleReply = async (reviewId: string, replyText: string) => {
        try {
            const response = await fetch('http://localhost:5000/api/reply-to-review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    reviewId,
                    replyText,
                    placeId: selectedPlaceId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || 'Failed to submit reply');
            }

            await fetchReviews(selectedPlaceId);
            toast.success('Reply submitted successfully!');
        } catch (error) {
            console.error('Error replying to review:', error);
            toast.error(`Failed to submit reply: ${error}`);
            throw error;
        }
    };

    useEffect(() => {
        const verifyToken = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/test-token', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await response.json();
                console.log('Token verification:', data);
            } catch (error) {
                console.error('Token verification failed:', error);
                toast.error('Authentication error. Please try logging in again.');
            }
        };

        if (token) {
            verifyToken();
        }
    }, [token]);

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    No authentication token found. Please log in.
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-screen  bg-gray-50 font-inter">
            <div className="mx-auto px-4 py-10 max-w-7xl">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-semibold text-gray-900">Business Reviews</h1>
                    <div className="text-sm text-gray-500">
                        Manage all your reviews in one place
                    </div>
                </div>

                {/* Search Section */}
                <div className="bg-white rounded-2xl shadow-sm p-8 mb-8 border border-gray-100">
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search for your business... eg: Jumboking Borivali"
                            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-600 placeholder-gray-400 text-[15px] bg-gray-200"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-blue-300 transition-all duration-200 font-medium shadow-sm hover:shadow"
                        >
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                </div>

                {/* Places List */}
                {places.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-8 mb-8 border border-gray-100">
                        <h2 className="text-lg font-medium text-gray-900 mb-6">Search Results</h2>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {places.map((place) => (
                                <button
                                    key={place.place_id}
                                    onClick={() => handlePlaceSelect(place.place_id)}
                                    className={`p-4 rounded-xl border transition-all duration-200 text-left hover:scale-[1.02] ${selectedPlaceId === place.place_id
                                            ? 'bg-blue-50 border-blue-200 shadow-sm'
                                            : 'hover:bg-gray-50 border-gray-100'
                                        }`}
                                >
                                    <h3 className="font-medium text-gray-300 hover:text-black">{place.name}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{place.formatted_address}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Reviews Section */}
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-200 border-t-blue-600"></div>
                    </div>
                ) : reviews.length > 0 ? (
                    <div className="space-y-6">
                        {reviews.map((review, i) => (
                            <ReviewCard
                                key={i}
                                review={review}
                                onReply={handleReply}
                            />
                        ))}
                    </div>
                ) : selectedPlaceId && (
                    <div className="text-center py-20 text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-lg">No reviews found for this business.</p>
                        <p className="text-sm text-gray-400 mt-2">Reviews will appear here once customers leave them.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
