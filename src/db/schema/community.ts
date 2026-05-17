import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { reportStatusEnum, reportTargetTypeEnum, voteTypeEnum } from "./enums"
import { users } from "./auth"
import { chapters, novels } from "./content"

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parentId: uuid("parent_id").references((): any => comments.id),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false),
  upvoteCount: integer("upvote_count").notNull().default(0),
  downvoteCount: integer("downvote_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const commentVotes = pgTable(
  "comment_votes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    voteType: voteTypeEnum("vote_type").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.commentId] })],
)

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    body: text("body"),
    isHidden: boolean("is_hidden").notNull().default(false),
    helpfulCount: integer("helpful_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reviews_user_novel_idx").on(t.userId, t.novelId)],
)

export const reviewVotes = pgTable(
  "review_votes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    voteType: voteTypeEnum("vote_type").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.reviewId] })],
)

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetType: reportTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  reason: text("reason").notNull(),
  status: reportStatusEnum("status").notNull().default("PENDING"),
  resolvedBy: text("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})
