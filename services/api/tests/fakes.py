from __future__ import annotations


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeTable:
    def __init__(self, name: str, store: dict[str, object]):
        self.name = name
        self.store = store
        self._single = False
        self._op = None
        self._data = None

    def select(self, *_args, **_kwargs):
        self._op = "select"
        return self

    def insert(self, data):
        self._op = "insert"
        self._data = data
        return self

    def update(self, data):
        self._op = "update"
        self._data = data
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def single(self):
        self._single = True
        return self

    def execute(self):
        if self._op == "select":
            data = self.store.get(self.name)
        elif self._op == "insert":
            if isinstance(self._data, dict):
                item = dict(self._data)
                item.setdefault("id", f"{self.name}-id")
                data = [item]
            else:
                data = self._data
        elif self._op == "update":
            data = [self._data] if isinstance(self._data, dict) else self._data
        else:
            data = self.store.get(self.name)

        if self._single and isinstance(data, list):
            data = data[0]
        return FakeResult(data)


class FakeClient:
    def __init__(self, store: dict[str, object]):
        self.store = store

    def table(self, name: str) -> FakeTable:
        return FakeTable(name, self.store)
