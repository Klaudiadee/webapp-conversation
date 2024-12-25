'use client'
import type { FC } from 'react'
import React from 'react'
import { HandThumbDownIcon, HandThumbUpIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import LoadingAnim from '../loading-anim'
import type { FeedbackFunc } from '../type'
import s from '../style.module.css'
import ImageGallery from '../../base/image-gallery'
import Thought from '../thought'
import { randomString } from '@/utils/string'
import type { ChatItem, MessageRating, VisionFile } from '@/types/app'
import Tooltip from '@/app/components/base/tooltip'
import WorkflowProcess from '@/app/components/workflow/workflow-process'
import { Markdown } from '@/app/components/base/markdown'
import type { Emoji } from '@/types/tools'

/** ===================== 新增：解析函数 ===================== **/
function parseThoughtAndReply(str: string) {
  if (!str) return { thought: '', reply: '' }

  const thoughtMatch = str.match(/<thought>([\s\S]*?)<\/thought>/i)
  const replyMatch   = str.match(/<reply>([\s\S]*?)<\/reply>/i)

  return {
    thought: thoughtMatch ? thoughtMatch[1] : '',
    reply:   replyMatch   ? replyMatch[1]   : ''
  }
}

/** ===================== 新增：渲染不同气泡的子组件 ===================== **/
function ThoughtBubble({ content }: { content: string }) {
  return (
    <div className={s.thoughtBubble}>
      {content}
    </div>
  )
}

function ReplyBubble({ content }: { content: string }) {
  return (
    <div className={s.replyBubble}>
      {content}
    </div>
  )
}
/** ======================================================= **/

const OperationBtn = ({ innerContent, onClick, className }: { innerContent: React.ReactNode; onClick?: () => void; className?: string }) => (
  <div
    className={`relative box-border flex items-center justify-center h-7 w-7 p-0.5 rounded-lg bg-white cursor-pointer text-gray-500 hover:text-gray-800 ${className ?? ''}`}
    style={{ boxShadow: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.05)' }}
    onClick={onClick && onClick}
  >
    {innerContent}
  </div>
)

const RatingIcon: FC<{ isLike: boolean }> = ({ isLike }) => {
  return isLike ? <HandThumbUpIcon className='w-4 h-4' /> : <HandThumbDownIcon className='w-4 h-4' />
}

const IconWrapper: FC<{ children: React.ReactNode | string }> = ({ children }) => {
  return <div className={'rounded-lg h-6 w-6 flex items-center justify-center hover:bg-gray-100'}>
    {children}
  </div>
}

type IAnswerProps = {
  item: ChatItem
  feedbackDisabled: boolean
  onFeedback?: FeedbackFunc
  isResponding?: boolean
  allToolIcons?: Record<string, string | Emoji>
}

// 保持原结构和对外参数不变
const Answer: FC<IAnswerProps> = ({
  item,
  feedbackDisabled = false,
  onFeedback,
  isResponding,
  allToolIcons,
}) => {
  const { id, content, feedback, agent_thoughts, workflowProcess } = item
  const isAgentMode = !!agent_thoughts && agent_thoughts.length > 0

  const { t } = useTranslation()

  /** ======== 保持原先的 feedback, getImgs, agentModeAnswer 逻辑不变 ======== **/
  const renderFeedbackRating = (rating: MessageRating | undefined) => {
    if (!rating) return null
    const isLike = rating === 'like'
    const ratingIconClassname = isLike ? 'text-primary-600 bg-primary-100 hover:bg-primary-200' : 'text-red-600 bg-red-100 hover:bg-red-200'
    return (
      <Tooltip
        selector={`user-feedback-${randomString(16)}`}
        content={isLike ? '取消赞同' : '取消反对'}
      >
        <div
          className={'relative box-border flex items-center justify-center h-7 w-7 p-0.5 rounded-lg bg-white cursor-pointer text-gray-500 hover:text-gray-800'}
          style={{ boxShadow: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.05)' }}
          onClick={async () => {
            await onFeedback?.(id, { rating: null })
          }}
        >
          <div className={`${ratingIconClassname} rounded-lg h-6 w-6 flex items-center justify-center`}>
            <RatingIcon isLike={isLike} />
          </div>
        </div>
      </Tooltip>
    )
  }

  const renderItemOperation = () => {
    const userOperation = () => {
      return feedback?.rating
        ? null
        : <div className='flex gap-1'>
          <Tooltip selector={`user-feedback-${randomString(16)}`} content={t('common.operation.like') as string}>
            {OperationBtn({ innerContent: <IconWrapper><RatingIcon isLike={true} /></IconWrapper>, onClick: () => onFeedback?.(id, { rating: 'like' }) })}
          </Tooltip>
          <Tooltip selector={`user-feedback-${randomString(16)}`} content={t('common.operation.dislike') as string}>
            {OperationBtn({ innerContent: <IconWrapper><RatingIcon isLike={false} /></IconWrapper>, onClick: () => onFeedback?.(id, { rating: 'dislike' }) })}
          </Tooltip>
        </div>
    }
    return (
      <div className={`${s.itemOperation} flex gap-2`}>
        {userOperation()}
      </div>
    )
  }

  const getImgs = (list?: VisionFile[]) => {
    if (!list) return []
    return list.filter(file => file.type === 'image' && file.belongs_to === 'assistant')
  }

  const agentModeAnswer = (
    <div>
      {agent_thoughts?.map((item, index) => (
        <div key={index}>
          {item.thought && (
            <Markdown content={item.thought} />
          )}
          {!!item.tool && (
            <Thought
              thought={item}
              allToolIcons={allToolIcons || {}}
              isFinished={!!item.observation || !isResponding}
            />
          )}
          {getImgs(item.message_files).length > 0 && (
            <ImageGallery srcs={getImgs(item.message_files).map(i => i.url)} />
          )}
        </div>
      ))}
    </div>
  )

  /** ============== 关键：先解析content里是否有<thought>/<reply> ============== **/
  const { thought, reply } = parseThoughtAndReply(content || '')

  // 用一个函数来决定最终渲染啥
  const renderContent = () => {
    if (isResponding && (isAgentMode ? (!content && (agent_thoughts || []).filter(it => !!it.thought || !!it.tool).length === 0) : !content)) {
      // 保持原先 "responding" 的渲染逻辑
      return (
        <div className='flex items-center justify-center w-6 h-5'>
          <LoadingAnim type='text' />
        </div>
      )
    } else if (isAgentMode) {
      // 若 agentMode 为真，按原先 agentModeAnswer
      return agentModeAnswer
    } else {
      // 不走 agentMode => 解析后的 thought/reply
      if (thought || reply) {
        // 如果解析到了 <thought>/<reply>，分成两块渲染
        return (
          <>
            {thought && <ThoughtBubble content={thought} />}
            {reply && <ReplyBubble content={reply} />}
          </>
        )
      } else {
        // 原逻辑: 直接 Markdown 渲染 content
        return <Markdown content={content} />
      }
    }
  }

  return (
    <div key={id}>
      <div className='flex items-start'>
        <div className={`${s.answerIcon} w-10 h-10 shrink-0`}>
          {isResponding && (
            <div className={s.typeingIcon}>
              <LoadingAnim type='avatar' />
            </div>
          )}
        </div>
        <div className={`${s.answerWrap}`}>
          <div className={`${s.answer} relative text-sm text-gray-900`}>
            <div className={`ml-2 py-3 px-4 bg-white rounded-tr-2xl rounded-b-2xl ${workflowProcess && 'min-w-[480px]'}`}>
              {workflowProcess && <WorkflowProcess data={workflowProcess} hideInfo />}
              {/* 调用我们封装的函数进行内容渲染 */}
              {renderContent()}
            </div>
              <div className='absolute top-[-14px] right-[-2px] flex flex-row justify-end gap-1'>
              {!feedbackDisabled && !item.feedbackDisabled && renderItemOperation()}
              {!feedbackDisabled && renderFeedbackRating(feedback?.rating)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(Answer)
