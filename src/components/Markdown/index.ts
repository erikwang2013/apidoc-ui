import Markdown from './Markdown.vue'
import Anchor from './Anchor.vue'
import Modal from './Modal.vue'
import { createModal } from '/@/utils/helper/createModal'

export const MdAnchor = Anchor

export const mdModal = createModal(Modal, { wrapOnSuccess: false })

export default Markdown
