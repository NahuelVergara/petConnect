import { useThemeColor } from "@/hooks/use-theme-color";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function FeedPost({
  post,
  onDelete,
  onEdit,
}: {
  post: any;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  // Likes
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(parseInt(post.likes) || 0);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  // Comentarios
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentsCount, setCommentsCount] = useState(
    parseInt(post.comments) || 0,
  );
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(
    null,
  );
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentOptionsTarget, setCommentOptionsTarget] = useState<any>(null);
  const [genericAlert, setGenericAlert] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const backgroundColor = useThemeColor({}, "background");
  const iconColor = useThemeColor({}, "icon");
  const [confirmDeletePayload, setConfirmDeletePayload] = useState<{
    type: "post" | "comment";
    id?: string;
  } | null>(null);

  useEffect(() => {
    const checkInitialLikeAndComments = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Fetch likes
      if (user) {
        setCurrentUserId(user.id);
        const { data } = await supabase
          .from("likes")
          .select("post_id")
          .eq("user_id", user.id)
          .eq("post_id", post.id)
          .maybeSingle();
        if (data) setLiked(true);

        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url, full_name")
          .eq("id", user.id)
          .single();

        if (profile) {
          if (profile.avatar_url) setCurrentUserAvatar(profile.avatar_url);
          if (profile.full_name) setCurrentUserName(profile.full_name);
        }
      }

      // Fetch initial comments count
      const { count, error } = await supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", post.id);

      if (!error && count !== null) {
        setCommentsCount(count);
      }
    };
    checkInitialLikeAndComments();
  }, [post.id]);

  const handleLike = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const newLiked = !liked;
    const newCount = newLiked ? likesCount + 1 : Math.max(0, likesCount - 1);

    // Optimistic UI update
    setLiked(newLiked);
    setLikesCount(newCount);

    try {
      if (newLiked) {
        // Registrar el like único
        const { error: likeError } = await supabase
          .from("likes")
          .insert({ user_id: user.id, post_id: post.id });
        if (likeError) throw likeError;

        if (post.authorId && post.authorId !== user.id) {
          const { error: notifError } = await supabase
            .from("notifications")
            .insert({
              user_id: post.authorId,
              actor_id: user.id,
              type: "like",
              post_id: post.id,
            });
          if (notifError)
            console.error("Error trigger like notification:", notifError);
        }
      } else {
        // Remover el like
        const { error: unlikeError } = await supabase
          .from("likes")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", post.id);
        if (unlikeError) throw unlikeError;
      }

      // Actualizar el contador general
      await supabase
        .from("posts")
        .update({ likes: newCount })
        .eq("id", post.id);
    } catch (err: any) {
      console.warn("No se pudo guardar el like único.", err.message);
      // Revert optimistic update
      setLiked(!newLiked);
      setLikesCount(likesCount);
    }
  };

  const fetchComments = async () => {
    try {
      setLoadingComments(true);

      const { data, error } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Obtenemos los perfiles de los usuarios de los comentarios
        const uniqueUserIds = Array.from(new Set(data.map((c) => c.user_id)));
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", uniqueUserIds);

        const profilesMap = (profiles || []).reduce((acc: any, prof: any) => {
          acc[prof.id] = prof;
          return acc;
        }, {});

        const EnrichedComments = data.map((c) => ({
          ...c,
          user: profilesMap[c.user_id] || {},
        }));

        setComments(EnrichedComments);
        setCommentsCount(EnrichedComments.length);
      } else {
        setComments([]);
      }
    } catch (e) {
      console.warn("Failed fetching comments:", e);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleComment = () => {
    setShowCommentsModal(true);
    fetchComments();
  };

  const cancelEditing = () => {
    setEditingCommentId(null);
    setCommentText("");
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;

      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentsCount((prev) => Math.max(0, prev - 1));
      setCommentOptionsTarget(null);
      setConfirmDeletePayload(null);
    } catch (err) {
      console.warn("Failed deleting comment", err);
      setGenericAlert({
        title: "Error",
        message: "No se pudo eliminar el comentario",
      });
      setConfirmDeletePayload(null);
    }
  };

  const showCommentOptions = (comment: any) => {
    setCommentOptionsTarget(comment);
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    try {
      setSubmittingComment(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (editingCommentId) {
        const { error } = await supabase
          .from("comments")
          .update({ content: commentText.trim() })
          .eq("id", editingCommentId);

        if (error) throw error;

        setComments((prev) =>
          prev.map((c) =>
            c.id === editingCommentId
              ? { ...c, content: commentText.trim() }
              : c,
          ),
        );
        cancelEditing();
        return;
      }

      const { data, error } = await supabase
        .from("comments")
        .insert({
          post_id: post.id,
          user_id: user.id,
          content: commentText.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      if (post.authorId && post.authorId !== user.id) {
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: post.authorId,
            actor_id: user.id,
            type: "comment",
            post_id: post.id,
          });
        if (notifError)
          console.error("Error trigger comment notification:", notifError);
      }

      setCommentText("");
      // Fetch new comments fully to get user data mappings easily
      await fetchComments();
    } catch (e) {
      console.warn("Failed posting comment:", e);
      setGenericAlert({
        title: "Error",
        message: "No se pudo publicar el comentario",
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const showOptions = () => {
    if (post.isMine) {
      setShowOptionsModal(true);
    } else {
      setGenericAlert({
        title: "Opciones",
        message: "No puedes modificar las publicaciones de otros.",
      });
    }
  };

  const renderGenericAlert = () => (
    <Modal
      visible={!!genericAlert}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setGenericAlert(null)}
    >
      <TouchableOpacity
        style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}
        activeOpacity={1}
        onPress={() => setGenericAlert(null)}
      >
        <View
          style={[
            styles.modalContent,
            {
              width: 300,
              padding: 24,
              alignItems: "center",
              backgroundColor: cardColor,
            },
          ]}
        >
          <Text
            style={[
              styles.modalTitle,
              { marginBottom: 12, textAlign: "center", color: textColor },
            ]}
          >
            {genericAlert?.title}
          </Text>
          <Text
            style={[
              styles.caption,
              {
                color: textColor,
                marginTop: 0,
                marginBottom: 24,
                textAlign: "center",
              },
            ]}
          >
            {genericAlert?.message}
          </Text>
          <TouchableOpacity
            style={[
              styles.postButton,
              { width: "100%", alignItems: "center", marginLeft: 0 },
            ]}
            onPress={() => setGenericAlert(null)}
          >
            <Text style={styles.postButtonText}>Entendido</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderConfirmDeleteModal = () => (
    <Modal
      visible={!!confirmDeletePayload}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setConfirmDeletePayload(null)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setConfirmDeletePayload(null)}
      >
        <View style={[styles.modalContent, { width: 300, padding: 24 }]}>
          <Text
            style={[
              styles.modalTitle,
              { marginBottom: 12, textAlign: "center" },
            ]}
          >
            ¿Estás seguro?
          </Text>
          <Text
            style={[
              styles.caption,
              { marginTop: 0, marginBottom: 24, textAlign: "center" },
            ]}
          >
            Esta acción no se puede deshacer. Se eliminará permanentemente.
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 16,
                backgroundColor: "#F0EBE1",
                alignItems: "center",
              }}
              onPress={() => setConfirmDeletePayload(null)}
            >
              <Text style={{ color: "#8A5A19", fontWeight: "600" }}>
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 16,
                backgroundColor: "#FF4B4B",
                alignItems: "center",
              }}
              onPress={() => {
                if (
                  confirmDeletePayload?.type === "comment" &&
                  confirmDeletePayload?.id
                ) {
                  deleteComment(confirmDeletePayload.id);
                } else if (confirmDeletePayload?.type === "post") {
                  setConfirmDeletePayload(null);
                  if (onDelete) onDelete();
                }
              }}
            >
              <Text style={{ color: "#FFF", fontWeight: "600" }}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderCommentOptionsModal = () => (
    <Modal
      visible={!!commentOptionsTarget}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setCommentOptionsTarget(null)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setCommentOptionsTarget(null)}
      >
        <View style={styles.modalContent}>
          <TouchableOpacity
            style={styles.modalOption}
            onPress={() => {
              setEditingCommentId(commentOptionsTarget?.id);
              setCommentText(commentOptionsTarget?.content);
              setCommentOptionsTarget(null);
            }}
          >
            <FontAwesome5 name="edit" size={16} color="#4A2A14" />
            <Text style={styles.modalOptionText}>Editar Comentario</Text>
          </TouchableOpacity>
          <View style={styles.modalDivider} />
          <TouchableOpacity
            style={styles.modalOption}
            onPress={() => {
              const id = commentOptionsTarget?.id;
              setCommentOptionsTarget(null);
              setConfirmDeletePayload({ type: "comment", id });
            }}
          >
            <FontAwesome5 name="trash-alt" size={16} color="#FF4B4B" />
            <Text style={[styles.modalOptionText, { color: "#FF4B4B" }]}>
              Eliminar
            </Text>
          </TouchableOpacity>
          <View style={styles.modalDivider} />
          <TouchableOpacity
            style={[styles.modalOption, { justifyContent: "center" }]}
            onPress={() => setCommentOptionsTarget(null)}
          >
            <Text style={[styles.modalOptionText, { color: "#8A5A19" }]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderCommentsModal = () => (
    <Modal
      visible={showCommentsModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCommentsModal(false)}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCommentsModal(false)}
        />
        <View style={styles.commentsContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comentarios</Text>
            <TouchableOpacity onPress={() => setShowCommentsModal(false)}>
              <Ionicons name="close" size={24} color="#4A2A14" />
            </TouchableOpacity>
          </View>

          {loadingComments ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text>Cargando comentarios...</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", marginVertical: 20 }}>
                  <Text style={{ color: "#8A5A19" }}>
                    Aún no hay comentarios. ¡Sé el primero!
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.commentItem}
                  activeOpacity={0.7}
                  onLongPress={() => {
                    if (item.user_id === currentUserId) {
                      showCommentOptions(item);
                    }
                  }}
                  delayLongPress={200}
                >
                  <Image
                    source={{
                      uri:
                        item.user.avatar_url ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.full_name || "Usuario")}&background=F0EBE1&color=8A5A19`,
                    }}
                    style={styles.commentAvatar}
                  />
                  <View style={styles.commentContent}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <Text style={styles.commentUser}>
                        {item.user.full_name || "Usuario"}
                      </Text>
                      {item.user_id === currentUserId && (
                        <TouchableOpacity
                          onPress={() => showCommentOptions(item)}
                          style={{ paddingHorizontal: 5 }}
                        >
                          <FontAwesome5
                            name="ellipsis-h"
                            size={12}
                            color="#8A5A19"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.commentText}>{item.content}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}

          <View style={styles.commentInputContainer}>
            {editingCommentId ? (
              <TouchableOpacity
                onPress={cancelEditing}
                style={{ marginRight: 12 }}
              >
                <Ionicons name="close-circle" size={28} color="#FF4B4B" />
              </TouchableOpacity>
            ) : (
              <Image
                source={{
                  uri:
                    currentUserAvatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserName || "Usuario")}&background=F0EBE1&color=8A5A19`,
                }}
                style={styles.commentInputAvatar}
              />
            )}
            <TextInput
              style={styles.commentInput}
              placeholder={
                editingCommentId
                  ? "Edita tu comentario..."
                  : "Agrega un comentario..."
              }
              placeholderTextColor="#8A5A19"
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.postButton,
                !commentText.trim() && { opacity: 0.5 },
              ]}
              onPress={submitComment}
              disabled={!commentText.trim() || submittingComment}
            >
              <Text style={styles.postButtonText}>
                {submittingComment
                  ? "..."
                  : editingCommentId
                    ? "Guardar"
                    : "Publicar"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  if (post.type === "single") {
    return (
      <View style={styles.postContainer}>
        {renderCommentsModal()}
        {renderCommentOptionsModal()}
        {renderGenericAlert()}
        {renderConfirmDeleteModal()}
        <Modal
          visible={showOptionsModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowOptionsModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowOptionsModal(false)}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setShowOptionsModal(false);
                  if (onEdit) onEdit();
                }}
              >
                <FontAwesome5 name="edit" size={16} color="#4A2A14" />
                <Text style={styles.modalOptionText}>Editar Descripción</Text>
              </TouchableOpacity>
              <View style={styles.modalDivider} />
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setShowOptionsModal(false);
                  setConfirmDeletePayload({ type: "post" });
                }}
              >
                <FontAwesome5 name="trash-alt" size={16} color="#FF4B4B" />
                <Text style={[styles.modalOptionText, { color: "#FF4B4B" }]}>
                  Eliminar
                </Text>
              </TouchableOpacity>
              <View style={styles.modalDivider} />
              <TouchableOpacity
                style={[styles.modalOption, { justifyContent: "center" }]}
                onPress={() => setShowOptionsModal(false)}
              >
                <Text style={[styles.modalOptionText, { color: "#8A5A19" }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <View style={styles.postHeader}>
          <View style={styles.headerLeft}>
            <Image
              source={{ uri: post.user.avatar }}
              style={styles.postAvatar}
            />
            <View>
              <Text style={[styles.userName, { color: textColor }]}>
                {post.user.name}
              </Text>
              <Text style={[styles.userSub, { color: tintColor }]}>
                {post.user.location}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={showOptions}>
            <FontAwesome5 name="ellipsis-h" size={16} color={textColor} />
          </TouchableOpacity>
        </View>

        <View style={styles.imageContainer}>
          <Image
            source={{ uri: post.image }}
            style={styles.mainImage}
            resizeMode="cover"
          />

          <View
            style={[styles.floatingActionBar, { backgroundColor: cardColor }]}
          >
            <View style={styles.actionGroup}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                <FontAwesome5
                  name="paw"
                  size={18}
                  color={liked ? "#FF4B4B" : tintColor}
                  solid={liked}
                />
                <Text style={[styles.actionText, { color: textColor }]}>
                  {likesCount}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleComment}
              >
                <FontAwesome5
                  name="comment"
                  size={18}
                  color={tintColor}
                  solid
                />
                <Text style={[styles.actionText, { color: textColor }]}>
                  {commentsCount}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS === "web") {
                  setGenericAlert({
                    title: "Error",
                    message:
                      "¡La función de compartir estará disponible pronto!",
                  });
                } else {
                  setGenericAlert({
                    title: "Error",
                    message: "Compartir, Función en desarrollo",
                  });
                }
              }}
            >
              <Ionicons name="share-social" size={22} color={tintColor} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.caption, { color: textColor }]}>
          <Text style={{ fontWeight: "bold" }}>{post.captionUser} </Text>
          {post.captionText}
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  postContainer: {
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: "transparent",
    elevation: 0,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  postAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
  },
  userSub: {
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "500",
  },
  imageContainer: {
    position: "relative",
    borderRadius: 20,
    overflow: "hidden",
    height: 320,
  },
  mainImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  floatingActionBar: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    elevation: 1, // subtle shadow for the pill
  },
  actionGroup: {
    flexDirection: "row",
    gap: 20,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionText: {
    fontWeight: "700",
    color: "#4A2A14",
    fontSize: 14,
  },
  caption: {
    marginTop: 16,
    color: "#4A2A14",
    lineHeight: 22,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    width: 250,
    overflow: "hidden",
    boxShadow: "0px 4px 10px rgba(0,0,0,0.1)",
    elevation: 5,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4A2A14",
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#F0EBE1",
  },
  commentsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FDFBF7",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "75%",
    paddingBottom: Platform.OS === "ios" ? 20 : 0,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EBE1",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4A2A14",
  },
  commentItem: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-start",
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: "#eee",
  },
  commentContent: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0EBE1",
  },
  commentUser: {
    fontWeight: "600",
    color: "#4A2A14",
    marginBottom: 4,
    fontSize: 14,
  },
  commentText: {
    color: "#8A5A19",
    fontSize: 14,
    lineHeight: 20,
  },
  commentInputContainer: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0EBE1",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#FDFBF7",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#F0EBE1",
  },
  postButton: {
    marginLeft: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#4A2A14",
    borderRadius: 16,
  },
  postButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
