use std::{cell::Cell, rc::Rc};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Role {
    Root,
    Owned,
    Child,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WindowError {
    Register,
    Create,
    Observation,
    Cleanup,
}

pub trait WindowApi {
    type Id: Copy;
    fn register(&mut self) -> Result<(), WindowError>;
    fn create(&mut self, role: Role, root: Option<Self::Id>) -> Result<Self::Id, WindowError>;
    fn same_thread(&self) -> bool;
    fn identity_matches(&self, id: Self::Id) -> bool;
    fn destroy(&mut self, id: Self::Id) -> Result<(), WindowError>;
    fn unregister(&mut self) -> Result<(), WindowError>;
}

pub struct OwnedWindows<A: WindowApi> {
    api: A,
    ids: Vec<A::Id>,
    active: bool,
    cleanup_failed: Rc<Cell<bool>>,
}
impl<A: WindowApi> OwnedWindows<A> {
    pub fn register(mut api: A) -> Result<Self, WindowError> {
        api.register()?;
        Ok(Self {
            api,
            ids: Vec::with_capacity(3),
            active: true,
            cleanup_failed: Rc::new(Cell::new(false)),
        })
    }
    pub fn create_all(&mut self) -> Result<(), WindowError> {
        if !self.ids.is_empty() || !self.active || !self.api.same_thread() {
            return Err(WindowError::Create);
        }
        for role in [Role::Root, Role::Owned, Role::Child] {
            let id = self.api.create(role, self.ids.first().copied())?;
            self.ids.push(id);
        }
        Ok(())
    }
    pub fn ids(&self) -> &[A::Id] {
        &self.ids
    }
    pub fn cleanup_status(&self) -> Rc<Cell<bool>> {
        self.cleanup_failed.clone()
    }
    pub fn close(&mut self) -> Result<(), WindowError> {
        if !self.active {
            return if self.cleanup_failed.get() {
                Err(WindowError::Cleanup)
            } else {
                Ok(())
            };
        }
        self.active = false;
        let result = self.cleanup();
        self.cleanup_failed.set(result.is_err());
        result
    }
    fn cleanup(&mut self) -> Result<(), WindowError> {
        if !self.api.same_thread() {
            return Err(WindowError::Cleanup);
        }
        while let Some(id) = self.ids.last().copied() {
            if !self.api.identity_matches(id) {
                return Err(WindowError::Cleanup);
            }
            self.api.destroy(id)?;
            self.ids.pop();
        }
        self.api.unregister()
    }
}
impl<A: WindowApi> Drop for OwnedWindows<A> {
    fn drop(&mut self) {
        let _ = self.close();
    }
}
