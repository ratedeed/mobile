const fs = require('fs');
const path = './src/screens/ContractorDashboardScreen.tsx';

let content = fs.readFileSync(path, 'utf8');

const oldImports = `import {
  getContractorPosts,
  createPost,
  likePost,
  unlikePost,
  deletePost,
  getPortfolio,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  updateContractorProfile,
} from '../api/contractor';`;

const newImports = `import {
  getPortfolio,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  updateContractorProfile,
} from '../api/contractor';
import {
  getContractorPosts,
  createPost,
  likePost,
  unlikePost,
  deletePost,
} from '../api/post';`;

content = content.replace(oldImports, newImports);
fs.writeFileSync(path, content);
