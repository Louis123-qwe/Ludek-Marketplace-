use std::{collections::HashMap, sync::Arc, time::Instant};

use sqlx::PgPool;
use tokio::sync::RwLock;

use crate::config::Config;

pub struct KeyCache {
    pub keys: HashMap<String, (Vec<u8>, Vec<u8>)>,
    pub fetched: Option<Instant>,
}

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub cfg: Arc<Config>,
    pub keys: Arc<RwLock<KeyCache>>,
}
