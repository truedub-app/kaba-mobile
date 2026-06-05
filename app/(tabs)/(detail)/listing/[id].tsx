import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Share,
  Alert,
  Linking,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ImageCarousel } from '@/components/ImageCarousel';
import { SellerCard } from '@/components/SellerCard';
import { Avatar } from '@/components/Avatar';
import { AppHeader } from '@/components/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { formatPrice, formatDate } from '@/src/lib/utils';
import { fetchListingById, fetchRelatedListings } from '@/src/hooks/useListings';
import { checkIsFavorited, toggleFavorite } from '@/src/hooks/useFavorites';
import { getOrCreateConversation } from '@/src/hooks/useMessages';
import { useAuthStore } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';
import type { Listing, Review } from '@/src/types';
import { ListingCard } from '@/components/ListingCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_WIDTH = SCREEN_WIDTH - 32; // 16px margin each side

const FLAG_MAP: Record<string, string> = {
  'Saudi Arabia': '🇸🇦',
  China: '🇨🇳',
  Turkey: '🇹🇷',
  UAE: '🇦🇪',
  France: '🇫🇷',
  Germany: '🇩🇪',
  USA: '🇺🇸',
  Japan: '🇯🇵',
  'South Korea': '🇰🇷',
  Italy: '🇮🇹',
  Spain: '🇪🇸',
  UK: '🇬🇧',
  India: '🇮🇳',
  Algeria: '🇩🇿',
};

function countryFlag(country: string): string {
  return FLAG_MAP[country] ?? '🌍';
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  const [listing, setListing] = useState<Listing | null>(null);
  const [related, setRelated] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [togglingFav, setTogglingFav] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Write review modal
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchListingById(id),
      session?.user ? checkIsFavorited(id, session.user.id) : Promise.resolve(false),
    ]).then(([l, faved]) => {
      setListing(l);
      setFavorited(faved);
      setLoading(false);
      if (l) {
        fetchRelatedListings(l.category_id, l.id).then(setRelated);
        // Fetch seller reviews
        supabase
          .from('reviews')
          .select('*, reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, avatar_url)')
          .eq('seller_id', l.seller_id)
          .order('created_at', { ascending: false })
          .limit(5)
          .then(({ data }) => { if (data) setReviews(data as Review[]); });
      }
    });
  }, [id, session?.user?.id]);

  const handleFavorite = async () => {
    if (!session) { router.push('/(auth)/login'); return; }
    setTogglingFav(true);
    const next = !favorited;
    setFavorited(next);
    await toggleFavorite(id, session.user!.id, !next);
    setTogglingFav(false);
  };

  const handleShare = async () => {
    if (!listing) return;
    await Share.share({
      message: `${listing.title} — ${formatPrice(listing.price)}\nhttps://dz-kaba.com/listings/${listing.id}`,
    });
  };

  const handleMessage = async () => {
    if (!session) { router.push('/(auth)/login'); return; }
    if (!listing) return;
    if (listing.seller_id === session.user!.id) return;
    setStartingChat(true);
    const conversationId = await getOrCreateConversation(
      listing.id,
      session.user!.id,
      listing.seller_id
    );
    setStartingChat(false);
    if (conversationId) {
      router.push(`/chat/${conversationId}`);
    } else {
      Alert.alert('Error', 'Could not start conversation. Please try again.');
    }
  };

  const handleDeleteListing = () => {
    Alert.alert(
      'Delete Listing',
      `Are you sure you want to delete "${listing?.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            setDeleting(true);
            const { error } = await supabase
              .from('listings')
              .delete()
              .eq('id', id);
            setDeleting(false);
            if (error) {
              Alert.alert('Delete Failed', error.message);
            } else {
              router.back();
            }
          },
        },
      ]
    );
  };

  const handleSubmitReview = async () => {
    if (!session || !listing) return;
    setSubmittingReview(true);
    const { error } = await supabase.from('reviews').insert({
      reviewer_id: session.user.id,
      seller_id: listing.seller_id,
      listing_id: listing.id,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    });
    setSubmittingReview(false);
    if (error) {
      Alert.alert('Error', error.code === '23505' ? 'You already reviewed this listing.' : error.message);
    } else {
      setReviewVisible(false);
      setReviewComment('');
      setReviewRating(5);
      // Refresh reviews
      supabase
        .from('reviews')
        .select('*, reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, avatar_url)')
        .eq('seller_id', listing.seller_id)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => { if (data) setReviews(data as Review[]); });
      Alert.alert('Thank you!', 'Your review has been submitted.');
    }
  };

  const handleWhatsApp = () => {
    if (!listing?.seller?.whatsapp_number) return;
    const number = listing.seller.whatsapp_number.replace(/\D/g, '');
    const url = `https://wa.me/${number}?text=${encodeURIComponent(`Hi! I'm interested in your listing: ${listing.title}`)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open WhatsApp'));
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.loader}>
        <Text style={styles.notFound}>Listing not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwn = session?.user?.id === listing.seller_id;
  const specs = Object.entries(listing.specifications ?? {});
  const hasWhatsApp = !!listing.seller?.whatsapp_number;

  const avgStars = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : listing.seller?.avg_rating ?? 0;
  const totalReviews = listing.seller?.total_reviews ?? reviews.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Sticky Header ── */}
      <AppHeader />

      {/* ── Sticky Search ── */}
      <SearchBar
        value=""
        onChangeText={() => {}}
        onSubmit={() => router.push('/(tabs)/browse')}
        placeholder="Search items, categories or locations..."
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Breadcrumb ── */}
        <View style={styles.breadcrumb}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')}>
            <Text style={styles.breadcrumbLink}>Home</Text>
          </TouchableOpacity>
          <Text style={styles.breadcrumbSep}>/</Text>
          {listing.category && (
            <>
              <TouchableOpacity onPress={() => router.push('/(tabs)/browse')}>
                <Text style={styles.breadcrumbLink}>{listing.category.name}</Text>
              </TouchableOpacity>
              <Text style={styles.breadcrumbSep}>/</Text>
            </>
          )}
          <Text style={styles.breadcrumbCurrent} numberOfLines={1}>
            {listing.title}
          </Text>
        </View>

        {/* ── Image Carousel ── */}
        <View style={styles.carouselWrap}>
          <ImageCarousel images={listing.images} height={280} width={CAROUSEL_WIDTH} />
        </View>

        {/* ── Price + Actions row ── */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(listing.price)}</Text>
          <View style={styles.priceActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleFavorite}
              disabled={togglingFav}
            >
              <Ionicons
                name={favorited ? 'heart' : 'heart-outline'}
                size={20}
                color={favorited ? '#ef4444' : '#374151'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Title ── */}
        <Text style={styles.title}>{listing.title}</Text>

        {/* ── Location + time ── */}
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color="#9ca3af" />
          <Text style={styles.metaText}>{listing.city}, Algeria</Text>
          <Text style={styles.metaDot}> · </Text>
          <Text style={styles.metaText}>Posted {formatDate(listing.created_at)}</Text>
        </View>

        {/* ── Condition badge ── */}
        {listing.condition && (
          <View style={styles.badges}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{listing.condition}</Text>
            </View>
            {listing.is_negotiable && (
              <View style={[styles.badge, styles.negoBadge]}>
                <Text style={[styles.badgeText, { color: '#15803d' }]}>Negotiable</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Description ── */}
        {listing.description && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Description</Text>
            <Text style={styles.description}>{listing.description}</Text>
          </View>
        )}

        {/* ── Specifications ── */}
        {specs.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Specifications</Text>
            <View style={styles.specsGrid}>
              {specs.map(([k, v]) => (
                <View key={k} style={styles.specItem}>
                  <Text style={styles.specKey}>{k}</Text>
                  <Text style={styles.specVal}>{String(v)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Reviews ── */}
        {totalReviews > 0 && (
          <View style={styles.card}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.cardTitle}>Reviews</Text>
              {!isOwn && session && (
                <TouchableOpacity
                  style={styles.writeReviewBtn}
                  onPress={() => setReviewVisible(true)}
                >
                  <Ionicons name="add" size={14} color="#15803d" />
                  <Text style={styles.writeReviewText}>Write a review</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Overall */}
            <View style={styles.ratingOverall}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={s <= Math.round(avgStars) ? 'star' : 'star-outline'}
                  size={16}
                  color="#fbbf24"
                />
              ))}
              <Text style={styles.ratingNum}>{avgStars.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({totalReviews} reviews)</Text>
            </View>
            {/* Review items */}
            {reviews.map((rev) => (
              <View key={rev.id} style={styles.reviewItem}>
                <View style={styles.reviewTop}>
                  <Avatar
                    name={rev.reviewer?.full_name}
                    avatarUrl={rev.reviewer?.avatar_url}
                    size={34}
                  />
                  <View style={styles.reviewMeta}>
                    <Text style={styles.reviewerName}>
                      {rev.reviewer?.full_name ?? 'User'}
                    </Text>
                    <Text style={styles.reviewTime}>{formatDate(rev.created_at)}</Text>
                  </View>
                </View>
                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name={s <= rev.rating ? 'star' : 'star-outline'}
                      size={13}
                      color="#fbbf24"
                    />
                  ))}
                </View>
                {rev.comment && (
                  <Text style={styles.reviewComment}>{rev.comment}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Owner Actions ── */}
        {isOwn && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.ownerBtn}
              onPress={() => router.push(`/listing/edit/${id}`)}
            >
              <Ionicons name="create-outline" size={18} color="#374151" />
              <Text style={styles.ownerBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ownerBtn, styles.ownerBtnBoost]}
              onPress={() => router.push(`/listing/boost/${id}`)}
            >
              <Ionicons name="flash-outline" size={18} color="#d97706" />
              <Text style={[styles.ownerBtnText, { color: '#d97706' }]}>Boost</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ownerBtn, styles.ownerBtnDelete]}
              onPress={handleDeleteListing}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  <Text style={[styles.ownerBtnText, { color: '#ef4444' }]}>Delete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Action Buttons ── */}
        {!isOwn && (
          <View style={styles.actionBtns}>
            <TouchableOpacity
              style={[styles.chatBtn, startingChat && { opacity: 0.7 }]}
              onPress={handleMessage}
              disabled={startingChat}
              activeOpacity={0.85}
            >
              {startingChat ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                  <Text style={styles.chatBtnText}>Chat with Seller</Text>
                </>
              )}
            </TouchableOpacity>

            {hasWhatsApp && (
              <TouchableOpacity
                style={styles.waBtn}
                onPress={handleWhatsApp}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#16a34a" />
                <Text style={styles.waBtnText}>WhatsApp Seller</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Seller Card ── */}
        {listing.seller && (
          <SellerCard seller={listing.seller} onWhatsApp={hasWhatsApp ? handleWhatsApp : undefined} />
        )}

        {/* ── Details Card ── */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color="#9ca3af" />
            <Text style={styles.detailText}>{listing.city}, Algeria</Text>
          </View>
          {listing.origin_country && (
            <View style={styles.detailRow}>
              <Ionicons name="globe-outline" size={16} color="#9ca3af" />
              <Text style={styles.detailText}>
                {'Imported from '}
                <Text style={{ fontWeight: '700', color: '#111827' }}>
                  {countryFlag(listing.origin_country)} {listing.origin_country}
                </Text>
              </Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color="#9ca3af" />
            <Text style={styles.detailText}>Posted {formatDate(listing.created_at)}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Ionicons name="eye-outline" size={16} color="#9ca3af" />
            <Text style={styles.detailText}>{listing.views ?? 0} views</Text>
          </View>
        </View>

        {/* ── Similar Listings ── */}
        {related.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>Similar Listings</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
            >
              {related.map((r) => (
                <View key={r.id} style={{ width: 164 }}>
                  <ListingCard listing={r} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* ── Write Review Modal ── */}
      <Modal
        visible={reviewVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setReviewVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Write a Review</Text>
              <TouchableOpacity onPress={() => setReviewVisible(false)}>
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Star rating */}
            <Text style={styles.ratingLabel}>Your Rating</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setReviewRating(s)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Ionicons
                    name={s <= reviewRating ? 'star' : 'star-outline'}
                    size={36}
                    color="#fbbf24"
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Comment */}
            <Text style={styles.ratingLabel}>Comment (optional)</Text>
            <TextInput
              style={styles.reviewInput}
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Share your experience with this seller…"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitReviewBtn, submittingReview && { opacity: 0.5 }]}
              onPress={handleSubmitReview}
              disabled={submittingReview}
              activeOpacity={0.85}
            >
              {submittingReview ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitReviewText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingBottom: 32 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFound: { fontSize: 18, fontWeight: '600', color: '#374151' },
  backBtn: {
    backgroundColor: '#15803d',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backBtnText: { color: '#fff', fontWeight: '600' },

  /* Breadcrumb */
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  breadcrumbLink: { fontSize: 13, color: '#9ca3af' },
  breadcrumbSep: { fontSize: 13, color: '#d1d5db' },
  breadcrumbCurrent: { fontSize: 13, color: '#374151', fontWeight: '600', flexShrink: 1 },

  /* Carousel */
  carouselWrap: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    marginBottom: 16,
  },

  /* Price row */
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  price: { fontSize: 26, fontWeight: '900', color: '#15803d' },
  priceActions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  /* Title + meta */
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 16,
    marginBottom: 6,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  metaText: { fontSize: 12, color: '#9ca3af' },
  metaDot: { fontSize: 12, color: '#d1d5db' },

  /* Badges */
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  badge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  negoBadge: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
  badgeText: { fontSize: 12, color: '#374151', fontWeight: '500' },

  /* Card sections */
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  description: { fontSize: 14, color: '#374151', lineHeight: 22 },

  /* Specs */
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  specItem: { width: '47%' },
  specKey: { fontSize: 11, color: '#9ca3af', textTransform: 'capitalize' },
  specVal: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 2 },

  /* Reviews */
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#15803d',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  writeReviewText: { fontSize: 12, color: '#15803d', fontWeight: '600' },
  ratingOverall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 12,
  },
  ratingNum: { fontSize: 14, fontWeight: '700', color: '#111827', marginLeft: 4 },
  ratingCount: { fontSize: 12, color: '#6b7280' },
  reviewItem: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginTop: 4,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  reviewMeta: { flex: 1 },
  reviewerName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  reviewTime: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  reviewStars: { flexDirection: 'row', gap: 2, marginBottom: 4 },
  reviewComment: { fontSize: 13, color: '#374151', lineHeight: 18 },

  /* Action buttons */
  actionBtns: {
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#15803d',
    borderRadius: 12,
    height: 52,
  },
  chatBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#16a34a',
    borderRadius: 12,
    height: 52,
    backgroundColor: '#f0fdf4',
  },
  waBtnText: { color: '#15803d', fontWeight: '700', fontSize: 15 },

  /* Details card */
  detailsCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailText: { fontSize: 14, color: '#374151', flex: 1 },

  /* Similar listings */
  relatedSection: { marginBottom: 16 },
  relatedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  /* Owner actions */
  ownerActions: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  ownerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 11,
    backgroundColor: '#fff',
  },
  ownerBtnBoost: { borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  ownerBtnDelete: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  ownerBtnText: { fontSize: 13, fontWeight: '700', color: '#374151' },

  /* Write review modal */
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  ratingLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 },
  starRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
    marginBottom: 16,
  },
  submitReviewBtn: {
    backgroundColor: '#15803d',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitReviewText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
